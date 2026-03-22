// ==================== 3D 场景管理模块 ====================

// 创建 3D 场景
function createScene(world, country, popData, config, updateProgress) {
    const camConfig = config.camera || {};
    const projConfig = config.projection || {};
    const sceneConfig = config.scene || {};
    const terrainConfig = config.terrain || {};
    
    console.log('[SCENE] Creating with config:', { camConfig, projConfig, terrainConfig });
    
    // 创建 Three.js 场景
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        camConfig.fov || 45, 
        window.innerWidth / window.innerHeight, 
        10, 
        1000
    );
    const camPos = camConfig.position || [0, -180, 80];
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor('#32430E');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, sceneConfig.ambientIntensity || 0.5);
    scene.add(ambientLight);

    const light = new THREE.DirectionalLight(0xffffff, sceneConfig.lightIntensity || 1.5);
    light.position.set(500, 400, 300);
    light.castShadow = true;
    light.shadow.mapSize.width = 6500;
    light.shadow.mapSize.height = 6500;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 2000;
    light.shadow.camera.left = 1000;
    light.shadow.camera.right = -1000;
    light.shadow.camera.top = 1000;
    light.shadow.camera.bottom = -1000;
    light.shadow.bias = -0.0001;
    light.shadow.radius = 8;
    scene.add(light);

    // 投影
    const projection = d3.geoMercator()
        .center(projConfig.center || [-66, 7])
        .scale(projConfig.scale || 450)
        .translate([0, 0]);

    // 绘制地图底板
    const baseMeshes = [];
    const processPolygon = (polygon) => {
        const shape = new THREE.Shape();
        let firstPoint = true;

        polygon.forEach(point => {
            const [lon, lat] = point;
            const [x, y] = projection([lon, lat]);
            if (firstPoint) {
                shape.moveTo(x, -y);
                firstPoint = false;
            } else {
                shape.lineTo(x, -y);
            }
        });

        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
        const material = new THREE.MeshStandardMaterial({
            color: 0xd8c39a,
            roughness: 0.8,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        scene.add(mesh);
        baseMeshes.push(mesh);
    };

    if (country.geometry.type === "Polygon") {
        country.geometry.coordinates.forEach(ring => processPolygon(ring));
    } else if (country.geometry.type === "MultiPolygon") {
        country.geometry.coordinates.forEach(polygon => {
            polygon.forEach(ring => processPolygon(ring));
        });
    }

    // 创建边界检测 Canvas
    const geoPath = d3.geoPath().projection(projection);
    const bounds = geoPath.bounds(country);
    const mapMinX = bounds[0][0], mapMaxX = bounds[1][0];
    const mapMinY = bounds[0][1], mapMaxY = bounds[1][1];

    const canvas = document.createElement('canvas');
    const padding = 100;
    canvas.width = Math.ceil(mapMaxX - mapMinX) + padding * 2;
    canvas.height = Math.ceil(mapMaxY - mapMinY) + padding * 2;
    const ctx = canvas.getContext('2d');
    ctx.translate(-mapMinX + padding, -mapMinY + padding);
    ctx.beginPath();
    geoPath.context(ctx)(country);
    ctx.closePath();

    const isPointInCountryPath = (x, y) => {
        const canvasX = x - mapMinX + padding;
        const canvasY = -y - mapMinY + padding;
        return ctx.isPointInPath(canvasX, canvasY);
    };

    // 处理人口数据并创建地形
    const positions = popData.positions || [];
    let terrain = null;
    
    if (positions.length > 0) {
        // 过滤数据点
        let filteredPositions = positions.filter(p => {
            if (p[2] <= 0.1) return false;
            return d3.geoContains(country, [p[0], p[1]]);
        });

        const maxDataPoints = terrainConfig.maxDataPoints || 30000;
        
        if (filteredPositions.length > maxDataPoints) {
            const step = Math.ceil(filteredPositions.length / maxDataPoints);
            filteredPositions = filteredPositions.filter((p, i) => i % step === 0);
        }

        let maxDensity = 0;
        for (let i = 0; i < filteredPositions.length; i += Math.ceil(filteredPositions.length / 1000)) {
            maxDensity = Math.max(maxDensity, filteredPositions[i][2]);
        }

        const heightRange = terrainConfig.heightRange || [0.5, 10];
        const heightScale = d3.scaleSqrt().domain([0, maxDensity]).range(heightRange);

        // 投影数据点
        const projectedData = filteredPositions.map(p => {
            const [lon, lat, density] = p;
            const [x, y] = projection([lon, lat]);
            return { x, y: -y, height: heightScale(density) };
        });

        // 创建 inCountryMap
        const gridSize = terrainConfig.gridSize || 400;
        const inCountryMap = [];
        
        for (let j = 0; j <= gridSize; j++) {
            const row = [];
            for (let i = 0; i <= gridSize; i++) {
                const gridX = mapMinX + i * (mapMaxX - mapMinX) / gridSize;
                const gridY = mapMinY + j * (mapMaxY - mapMinY) / gridSize;
                row.push(isPointInCountryPath(gridX, gridY));
            }
            inCountryMap.push(row);
        }

        // 使用 Web Worker 计算 IDW
        updateProgress(null, 'Computing terrain (IDW)...');
        
        return new Promise((resolve) => {
            const worker = new Worker('./js/idw-worker.js');
            
            worker.onmessage = function(e) {
                if (e.data.type === 'progress') {
                    updateProgress(null, `Computing terrain... ${Math.round(e.data.progress)}%`);
                } else if (e.data.type === 'complete') {
                    const heightMap = e.data.heightMap;
                    
                    // 计算高度范围
                    let minHeight = Infinity, maxHeight = -Infinity;
                    for (let j = 0; j <= gridSize; j++) {
                        for (let i = 0; i <= gridSize; i++) {
                            if (inCountryMap[j][i] && heightMap[j][i] > 0) {
                                minHeight = Math.min(minHeight, heightMap[j][i]);
                                maxHeight = Math.max(maxHeight, heightMap[j][i]);
                            }
                        }
                    }
                    
                    if (minHeight === Infinity) minHeight = 0;
                    if (maxHeight === -Infinity) maxHeight = 10;
                    
                    // 创建地形
                    updateProgress(null, 'Building geometry...');
                    terrain = buildTerrain(
                        heightMap, inCountryMap, gridSize,
                        mapMinX, mapMaxX, mapMinY, mapMaxY,
                        minHeight, maxHeight
                    );
                    
                    if (terrain) {
                        scene.add(terrain);
                        // 初始化比例尺
                        initScaleBar(minHeight, maxHeight, (h) => getTerrainColor(h, minHeight, maxHeight));
                    }
                    
                    // 自动缩放
                    const box = new THREE.Box3().setFromObject(scene);
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const scaleFactor = (sceneConfig.autoScaleFactor || 150) / Math.max(size.x, size.y);
                    scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
                    
                    resolve({ scene, camera, renderer, controls, light, ambientLight, baseMeshes, terrain });
                }
            };
            
            worker.onerror = function(err) {
                console.error('[WORKER] Error:', err);
                // 回退到主线程计算
                resolve(null);
            };
            
            // 发送数据到 Worker
            worker.postMessage({
                projectedData,
                gridSize,
                mapMinX, mapMaxX, mapMinY, mapMaxY,
                inCountryMap,
                searchRadius: Math.max(
                    (mapMaxX - mapMinX) / gridSize,
                    (mapMaxY - mapMinY) / gridSize
                ) * 2
            });
        });
    }
    
    // 无人口数据的情况
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scaleFactor = (sceneConfig.autoScaleFactor || 150) / Math.max(size.x, size.y);
    scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
    
    return Promise.resolve({ scene, camera, renderer, controls, light, ambientLight, baseMeshes, terrain: null });
}

// 构建地形几何体
function buildTerrain(heightMap, inCountryMap, gridSize, mapMinX, mapMaxX, mapMinY, mapMaxY, minHeight, maxHeight) {
    const cellWidth = (mapMaxX - mapMinX) / gridSize;
    const cellHeight = (mapMaxY - mapMinY) / gridSize;
    
    const vertices = [], indices = [], normals = [], uvs = [], colors = [];
    const vertexMap = new Map();
    let vertexIndex = 0;

    // 生成顶点
    for (let j = 0; j <= gridSize; j++) {
        for (let i = 0; i <= gridSize; i++) {
            if (inCountryMap[j][i]) {
                const x = mapMinX + i * cellWidth;
                const y = mapMinY + j * cellHeight;
                const z = Math.max(0.5, heightMap[j][i]);
                vertices.push(x, y, z);
                uvs.push(i / gridSize, j / gridSize);
                
                const color = getTerrainColor(z, minHeight, maxHeight);
                colors.push(color.r, color.g, color.b);
                
                vertexMap.set(`${i},${j}`, vertexIndex);
                vertexIndex++;
            }
        }
    }

    // 生成索引
    for (let j = 0; j < gridSize; j++) {
        for (let i = 0; i < gridSize; i++) {
            const aIn = inCountryMap[j][i];
            const bIn = inCountryMap[j][i + 1];
            const cIn = inCountryMap[j + 1][i];
            const dIn = inCountryMap[j + 1][i + 1];
            
            const a = vertexMap.get(`${i},${j}`);
            const b = vertexMap.get(`${i + 1},${j}`);
            const c = vertexMap.get(`${i},${j + 1}`);
            const d = vertexMap.get(`${i + 1},${j + 1}`);
            
            const inCount = (aIn?1:0) + (bIn?1:0) + (cIn?1:0) + (dIn?1:0);
            
            if (inCount >= 2) {
                if (a !== undefined && b !== undefined && c !== undefined) {
                    indices.push(a, b, c);
                }
                if (b !== undefined && c !== undefined && d !== undefined) {
                    indices.push(b, d, c);
                }
            }
        }
    }

    // 计算法线
    for (let i = 0; i < vertices.length; i += 3) {
        normals.push(0, 0, 1);
    }
    
    for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i] * 3, i2 = indices[i + 1] * 3, i3 = indices[i + 2] * 3;
        const v1 = new THREE.Vector3(vertices[i1], vertices[i1+1], vertices[i1+2]);
        const v2 = new THREE.Vector3(vertices[i2], vertices[i2+1], vertices[i2+2]);
        const v3 = new THREE.Vector3(vertices[i3], vertices[i3+1], vertices[i3+2]);
        const normal = new THREE.Vector3().subVectors(v2, v1).cross(new THREE.Vector3().subVectors(v3, v1)).normalize();
        normals[i1] += normal.x; normals[i1+1] += normal.y; normals[i1+2] += normal.z;
        normals[i2] += normal.x; normals[i2+1] += normal.y; normals[i2+2] += normal.z;
        normals[i3] += normal.x; normals[i3+1] += normal.y; normals[i3+2] += normal.z;
    }
    
    for (let i = 0; i < normals.length; i += 3) {
        const n = new THREE.Vector3(normals[i], normals[i+1], normals[i+2]).normalize();
        normals[i] = n.x; normals[i+1] = n.y; normals[i+2] = n.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    console.log(`[SCENE] Terrain: ${vertices.length} vertices, ${indices.length/3} triangles`);
    
    return mesh;
}

// 地形颜色映射
function getTerrainColor(h, minH, maxH) {
    if (h <= minH) return new THREE.Color(0xd8c39a);
    if (h >= maxH) return new THREE.Color(0x8b0000);
    
    const t = (h - minH) / (maxH - minH);
    let r, g, b;
    
    if (t < 0.33) {
        const s = t / 0.33;
        r = 0.847 + (1 - 0.847) * s;
        g = 0.765 + (1 - 0.765) * s;
        b = 0.604 + (1 - 0.604) * s;
    } else if (t < 0.66) {
        const s = (t - 0.33) / 0.33;
        r = 1;
        g = 1 - 0.35 * s;
        b = 1 - 0.65 * s;
    } else {
        const s = (t - 0.66) / 0.34;
        r = 1;
        g = 0.65 - 0.65 * s;
        b = 0.35 - 0.35 * s;
    }
    return new THREE.Color(r, g, b);
}

// 初始化比例尺
function initScaleBar(minHeight, maxHeight, getColorByHeight) {
    const scaleBar = document.getElementById("scaleBar");
    if (!scaleBar || minHeight === undefined || maxHeight === undefined) return;

    const titleElement = document.querySelector('.title_title');
    let scaleWidth = 200;
    if (titleElement) {
        const titleRect = titleElement.getBoundingClientRect();
        scaleWidth = titleRect.width;
    }

    const steps = 50;
    const svg = scaleBar.querySelector('.scale-bar-gradient');
    const gradient = scaleBar.querySelector('#heightGradient');
    const rect = scaleBar.querySelector('rect');
    
    if (!svg || !gradient || !rect) return;

    svg.setAttribute('width', scaleWidth);
    rect.setAttribute('width', scaleWidth);
    gradient.innerHTML = '';

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const height = minHeight + (maxHeight - minHeight) * t;
        const color = getColorByHeight(height);
        const r = Math.round(color.r * 255);
        const g = Math.round(color.g * 255);
        const b = Math.round(color.b * 255);
        
        const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop.setAttribute('offset', (100 * t).toFixed(1) + '%');
        stop.setAttribute('stop-color', `rgb(${r},${g},${b})`);
        gradient.appendChild(stop);
    }

    const formatHeight = (h) => {
        if (h < 1) return h.toFixed(2);
        if (h < 10) return h.toFixed(1);
        return Math.round(h);
    };

    const scaleLabelLeft = scaleBar.querySelector('#scaleLabelLeft');
    const scaleLabelMiddle = scaleBar.querySelector('#scaleLabelMiddle');
    const scaleLabelRight = scaleBar.querySelector('#scaleLabelRight');
    
    if (scaleLabelLeft) scaleLabelLeft.textContent = formatHeight(minHeight);
    if (scaleLabelMiddle) {
        scaleLabelMiddle.textContent = formatHeight((minHeight + maxHeight) / 2);
        scaleLabelMiddle.setAttribute('x', scaleWidth / 2);
    }
    if (scaleLabelRight) {
        scaleLabelRight.textContent = formatHeight(maxHeight);
        scaleLabelRight.setAttribute('x', scaleWidth);
    }
}

// 初始化小地图
function initMinimap(world, countryCode) {
    const container = d3.select("#minimap");
    if (container.empty()) return;

    // 获取容器实际尺寸
    const containerNode = container.node();
    const width = containerNode.clientWidth || 260;
    const height = containerNode.clientHeight || 150;

    // 清空容器
    container.selectAll("*").remove();

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    // 根据容器尺寸调整投影
    const scale = Math.min(width, height) / 3.5;
    const projection = d3.geoMercator()
        .scale(scale)
        .translate([width / 2, height / 1.5]);
    const path = d3.geoPath().projection(projection);

    svg.selectAll("path")
        .data(world.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => d.id === countryCode ? "#d8c39a" : "#4a5a2a")
        .attr("stroke", d => d.id === countryCode ? "#f5e6c5" : "#666")
        .attr("stroke-width", d => d.id === countryCode ? 1.5 : 0.3)
        .attr("opacity", d => d.id === countryCode ? 1 : 0.6);

    container.on("click", () => {
        window.location.href = 'index.html';
    });
}

// 导出模块
window.SceneManager = {
    createScene,
    initMinimap
};
