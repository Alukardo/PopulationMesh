// ==================== 加载管理模块 ====================

const _loadStartTime = Date.now();
const _loadDetails = {};

function updateLoading(percent, status, key = null, time = null) {
    const progressBar = document.getElementById('loadingProgressBar');
    const statusEl = document.getElementById('loadingStatus');
    const detailsEl = document.getElementById('loadingDetails');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (statusEl) statusEl.textContent = status;
    
    if (detailsEl && key) {
        if (time !== null) {
            _loadDetails[key] = { time, status: 'done' };
        } else {
            _loadDetails[key] = { time: 0, status: 'loading' };
        }
        
        detailsEl.innerHTML = Object.entries(_loadDetails).map(([k, v]) => {
            const timeStr = v.time > 0 ? `${v.time}ms` : '...';
            return `<div class="loading-detail-item ${v.status}">
                <span>${k}</span>
                <span class="loading-time">${timeStr}</span>
            </div>`;
        }).join('');
        detailsEl.scrollTop = detailsEl.scrollHeight;
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.style.display = 'none', 500);
    }
    
    const totalTime = Date.now() - _loadStartTime;
    console.log('%c========== 加载时间统计 ==========', 'color: #4CAF50; font-weight: bold;');
    console.log(`%c总加载时间: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`, 'color: #2196F3; font-size: 14px;');
    console.log('%c各文件加载时间:', 'color: #FF9800;');
    Object.entries(_loadDetails).forEach(([k, v]) => console.log(`  ${k}: ${v.time}ms`));
    console.log('%c====================================', 'color: #4CAF50; font-weight: bold;');
}

async function fetchWithTiming(url, name) {
    const startTime = Date.now();
    updateLoading(null, `Loading ${name}...`, name);
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const time = Date.now() - startTime;
        _loadDetails[name] = { time, status: 'done' };
        updateLoading(null, `Loaded ${name}`, name, time);
        console.log(`[LOAD] ${name}: ${time}ms`);
        return data;
    } catch (err) {
        _loadDetails[name] = { time: `Error: ${err.message}`, status: 'error' };
        console.error(`[ERROR] ${name}: ${err.message}`);
        throw err;
    }
}

async function fetchWithProgress(url, name, onProgress) {
    const startTime = Date.now();
    updateLoading(null, `Loading ${name}...`, name);
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const contentLength = res.headers.get('content-length');
        if (!contentLength) {
            const data = await res.json();
            const time = Date.now() - startTime;
            _loadDetails[name] = { time, status: 'done' };
            updateLoading(null, `Loaded ${name}`, name, time);
            console.log(`[LOAD] ${name}: ${time}ms`);
            return data;
        }
        
        const total = parseInt(contentLength, 10);
        let loaded = 0;
        const reader = res.body.getReader();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            const percent = Math.round((loaded / total) * 100);
            if (onProgress) onProgress(percent);
        }
        
        const allChunks = new Uint8Array(total);
        let pos = 0;
        for (const chunk of chunks) {
            allChunks.set(chunk, pos);
            pos += chunk.length;
        }
        
        const data = JSON.parse(new TextDecoder().decode(allChunks));
        const time = Date.now() - startTime;
        _loadDetails[name] = { time, status: 'done' };
        updateLoading(null, `Loaded ${name}`, name, time);
        console.log(`[LOAD] ${name}: ${time}ms (${(total/1024/1024).toFixed(2)}MB)`);
        
        return data;
    } catch (err) {
        _loadDetails[name] = { time: `Error: ${err.message}`, status: 'error' };
        console.error(`[ERROR] ${name}: ${err.message}`);
        throw err;
    }
}

// ==================== 主程序 ====================

const params = new URLSearchParams(window.location.search);
const countryCode = params.get('countryCode') || params.get('SimpleCode') || 'VEN';
const countryNameFromURL = params.get('countryName');

let countryConfig = {};
let defaultConfig = {};
let countryName = '';

console.log(`%c[START] 加载国家: ${countryCode}`, 'color: #2196F3; font-weight: bold;');

async function init() {
    try {
        // 加载配置
        updateLoading(5, 'Loading configuration...');
        
        try {
            const config = await fetchWithTiming('/data/countries-config.json', 'Config');
            defaultConfig = config.default || {};
            countryConfig = (config.countries || {})[countryCode] || {};
            countryName = countryNameFromURL || countryConfig.name || countryCode;
            console.log('[CONFIG] Loaded:', countryCode, '->', countryName);
        } catch (err) {
            console.warn('[WARN] Config not found, using code');
            countryName = countryCode;
        }
        
        // 更新页面标题
        document.title = `${countryName} - Population Density Map`;
        
        const loadingEl = document.getElementById('loadingCountry');
        const titleEl = document.getElementById('countryTitle');
        if (loadingEl) loadingEl.textContent = countryName.toUpperCase();
        if (titleEl) titleEl.textContent = countryName.toUpperCase();
        
        const infoTextEl = document.getElementById('infoText');
        if (infoTextEl && countryConfig.infoText) {
            infoTextEl.textContent = countryConfig.infoText;
        }
        
        // 加载世界地图
        updateLoading(15, 'Loading world map...');
        const world = await fetchWithTiming('/data/world.json', 'World Map');
        
        const country = world.features.find(f => f.id === countryCode);
        if (!country) {
            updateLoading(100, 'Country not found');
            alert(`Country "${countryCode}" not found`);
            return;
        }
        
        // 加载人口数据
        updateLoading(30, 'Loading population data...');
        
        let popData = { positions: [] };
        const popUrl = `/data/populationData/${countryCode}_population_data.json`;
        
        try {
            popData = await fetchWithProgress(popUrl, 'Population Data', (percent) => {
                updateLoading(30 + percent * 0.4, `Loading... ${percent}%`);
            });
        } catch (err) {
            console.warn(`[WARN] No data for ${countryCode}`);
        }
        
        // 合并配置
        updateLoading(80, 'Creating 3D scene...');
        const config = { 
            ...defaultConfig, 
            ...countryConfig,
            camera: { ...defaultConfig.camera, ...countryConfig.camera },
            projection: { ...defaultConfig.projection, ...countryConfig.projection },
            terrain: { ...defaultConfig.terrain, ...countryConfig.terrain },
            scene: { ...defaultConfig.scene, ...countryConfig.scene }
        };
        
        // 创建场景
        const sceneData = await SceneManager.createScene(world, country, popData, config, updateLoading);
        
        if (!sceneData) {
            console.error('[ERROR] Failed to create scene');
            return;
        }
        
        const { scene, camera, renderer, controls, light, ambientLight, baseMeshes, terrain } = sceneData;
        
        // 动画循环
        let time = 0;
        let lightRotating = false;
        
        const lightBtn = document.getElementById("lightToggle");
        if (lightBtn) {
            lightBtn.addEventListener("click", () => {
                lightRotating = !lightRotating;
                lightBtn.classList.toggle("active", lightRotating);
            });
        }
        
        function animate() {
            requestAnimationFrame(animate);
            if (lightRotating) {
                time += 0.0005;
                light.position.x = Math.cos(time) * 500;
                light.position.z = Math.sin(time) * 500;
                light.position.y = 400;
                light.lookAt(0, 0, 0);
            }
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
        
        // 自适应窗口
        window.addEventListener("resize", () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // 初始化UI
        SceneManager.initMinimap(world, countryCode);
        
        if (typeof initNavigation === 'function') {
            initNavigation(countryName);
        }
        
        setTimeout(() => {
            UIManager.initControlMenu(renderer, baseMeshes, terrain, light, ambientLight);
        }, 100);
        
        console.log('[MAIN] Done');
        
        updateLoading(100, 'Complete!');
        setTimeout(hideLoading, 500);
        
    } catch (err) {
        console.error('[FATAL]', err);
        updateLoading(100, 'Error: ' + err.message);
    }
}

init();
