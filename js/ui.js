// ==================== UI 控制模块 ====================

// 初始化控制菜单
function initControlMenu(renderer, baseMeshes, terrain, light, ambientLight) {
    const defaultValues = {
        bgColor: '#32430E',
        baseColor: '#d8c39a',
        terrainColor: '#d8c39a',
        lightIntensity: 1.5,
        ambientIntensity: 0.5,
        shadowsEnabled: true,
        heightScale: 1.0
    };

    const menuToggle = document.getElementById("menuToggle");
    const menuContent = document.getElementById("menuContent");
    
    if (menuToggle && menuContent) {
        menuToggle.addEventListener("click", () => menuContent.classList.toggle("open"));
    }

    // 获取控件元素
    const bgColorInput = document.getElementById("bgColor");
    const baseColorInput = document.getElementById("baseColor");
    const terrainColorInput = document.getElementById("terrainColor");
    const lightIntensityInput = document.getElementById("lightIntensity");
    const lightIntensityValue = document.getElementById("lightIntensityValue");
    const ambientIntensityInput = document.getElementById("ambientIntensity");
    const ambientIntensityValue = document.getElementById("ambientIntensityValue");
    const shadowToggle = document.getElementById("shadowToggle");
    const heightScaleInput = document.getElementById("heightScale");
    const heightScaleValue = document.getElementById("heightScaleValue");
    const presetButtons = document.querySelectorAll(".preset-btn");
    const resetBtn = document.getElementById("resetBtn");

    // 背景颜色
    if (bgColorInput) {
        bgColorInput.addEventListener("input", (e) => {
            renderer.setClearColor(e.target.value);
            updateUITheme(e.target.value);
        });
    }

    // 底板颜色
    if (baseColorInput) {
        baseColorInput.addEventListener("input", (e) => {
            const color = new THREE.Color(e.target.value);
            baseMeshes.forEach(m => m.material.color.copy(color));
        });
    }

    // 地形颜色
    if (terrainColorInput && terrain) {
        terrainColorInput.addEventListener("input", (e) => {
            terrain.material.vertexColors = false;
            terrain.material.color.set(e.target.value);
        });
    }

    // 光源强度
    if (lightIntensityInput) {
        lightIntensityInput.addEventListener("input", (e) => {
            const value = parseFloat(e.target.value);
            light.intensity = value;
            if (lightIntensityValue) lightIntensityValue.textContent = value.toFixed(1);
        });
    }

    // 环境光强度
    if (ambientIntensityInput) {
        ambientIntensityInput.addEventListener("input", (e) => {
            const value = parseFloat(e.target.value);
            ambientLight.intensity = value;
            if (ambientIntensityValue) ambientIntensityValue.textContent = value.toFixed(1);
        });
    }

    // 阴影开关
    if (shadowToggle) {
        shadowToggle.addEventListener("change", (e) => {
            renderer.shadowMap.enabled = e.target.checked;
            light.castShadow = e.target.checked;
            if (terrain) {
                terrain.castShadow = e.target.checked;
                terrain.receiveShadow = e.target.checked;
            }
            baseMeshes.forEach(m => m.receiveShadow = e.target.checked);
        });
    }

    // 地形高度缩放
    if (heightScaleInput && terrain) {
        heightScaleInput.addEventListener("input", (e) => {
            const scale = parseFloat(e.target.value);
            if (heightScaleValue) heightScaleValue.textContent = scale.toFixed(1);
            
            // 更新地形高度
            if (terrain && terrain.userData.originalPositions) {
                const positions = terrain.geometry.attributes.position.array;
                const originalPositions = terrain.userData.originalPositions;
                const baseHeight = terrain.userData.baseHeight || 0.5;
                
                for (let i = 2; i < positions.length; i += 3) {
                    const originalZ = originalPositions[i];
                    const scaledZ = baseHeight + (originalZ - baseHeight) * scale;
                    positions[i] = scaledZ;
                }
                
                terrain.geometry.attributes.position.needsUpdate = true;
                terrain.geometry.computeVertexNormals();
            }
        });
    }

    // 预设主题
    const presets = {
        default: { bgColor: '#32430E', baseColor: '#d8c39a', terrainColor: '#d8c39a', lightIntensity: 1.5, ambientIntensity: 0.5 },
        desert: { bgColor: '#F4E4BC', baseColor: '#E6D5B8', terrainColor: '#D4A574', lightIntensity: 2.0, ambientIntensity: 0.7 },
        ocean: { bgColor: '#1E3A5F', baseColor: '#4A90A4', terrainColor: '#6BB3C7', lightIntensity: 1.2, ambientIntensity: 0.4 },
        forest: { bgColor: '#2D4A2E', baseColor: '#6B8E5A', terrainColor: '#8FAF7F', lightIntensity: 1.3, ambientIntensity: 0.5 },
        night: { bgColor: '#0A0E27', baseColor: '#2A2A3E', terrainColor: '#4A4A6E', lightIntensity: 0.8, ambientIntensity: 0.2 }
    };

    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const preset = presets[btn.dataset.preset];
            if (!preset) return;
            
            presetButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            if (bgColorInput) {
                bgColorInput.value = preset.bgColor;
                renderer.setClearColor(preset.bgColor);
                updateUITheme(preset.bgColor);
            }
            if (baseColorInput) {
                baseColorInput.value = preset.baseColor;
                const color = new THREE.Color(preset.baseColor);
                baseMeshes.forEach(m => m.material.color.copy(color));
            }
            if (terrainColorInput && terrain) {
                terrainColorInput.value = preset.terrainColor;
                terrain.material.vertexColors = false;
                terrain.material.color.set(preset.terrainColor);
            }
            if (lightIntensityInput) {
                lightIntensityInput.value = preset.lightIntensity;
                light.intensity = preset.lightIntensity;
                if (lightIntensityValue) lightIntensityValue.textContent = preset.lightIntensity.toFixed(1);
            }
            if (ambientIntensityInput) {
                ambientIntensityInput.value = preset.ambientIntensity;
                ambientLight.intensity = preset.ambientIntensity;
                if (ambientIntensityValue) ambientIntensityValue.textContent = preset.ambientIntensity.toFixed(1);
            }
        });
    });

    // 重置按钮
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (bgColorInput) {
                bgColorInput.value = defaultValues.bgColor;
                renderer.setClearColor(defaultValues.bgColor);
                updateUITheme(defaultValues.bgColor);
            }
            if (baseColorInput) {
                baseColorInput.value = defaultValues.baseColor;
                const color = new THREE.Color(defaultValues.baseColor);
                baseMeshes.forEach(m => m.material.color.copy(color));
            }
            if (terrainColorInput && terrain) {
                terrainColorInput.value = defaultValues.terrainColor;
                terrain.material.vertexColors = true;
                terrain.geometry.attributes.color.needsUpdate = true;
            }
            if (lightIntensityInput) {
                lightIntensityInput.value = defaultValues.lightIntensity;
                light.intensity = defaultValues.lightIntensity;
                if (lightIntensityValue) lightIntensityValue.textContent = defaultValues.lightIntensity.toFixed(1);
            }
            if (ambientIntensityInput) {
                ambientIntensityInput.value = defaultValues.ambientIntensity;
                ambientLight.intensity = defaultValues.ambientIntensity;
                if (ambientIntensityValue) ambientIntensityValue.textContent = defaultValues.ambientIntensity.toFixed(1);
            }
            if (heightScaleInput) {
                heightScaleInput.value = defaultValues.heightScale;
                if (heightScaleValue) heightScaleValue.textContent = defaultValues.heightScale;
            }
            presetButtons.forEach(b => b.classList.remove("active"));
        });
    }
}

// 更新 UI 主题
function updateUITheme(bgColor) {
    const rgb = hexToRgb(bgColor);
    if (!rgb) return;
    
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    const isDark = brightness < 128;
    
    const colors = {
        bg: bgColor,
        border: adjustBrightness(bgColor, isDark ? 60 : -40),
        text: isDark ? '#f8f1dc' : '#2a2a2a',
        buttonBg: rgba(bgColor, 0.95)
    };
    
    // 更新各个元素
    const elements = {
        '.minimap': ['background', 'borderColor'],
        '.nav-button:not(:disabled)': ['background', 'borderColor', 'color'],
        '.menu-toggle': ['background', 'borderColor', 'color'],
        '.menu-content': ['background', 'borderColor'],
        '.reset-btn': ['background', 'borderColor', 'color'],
        '.preset-theme-bar': ['background', 'borderColor'],
        '.info-text': ['background', 'borderColor', 'color'],
        '.title': ['color'],
        '.light-control-btn': ['borderColor', 'color'],
        '.scale-bar': ['background', 'borderColor'],
        '.scale-bar-title': ['color']
    };
    
    Object.entries(elements).forEach(([selector, props]) => {
        document.querySelectorAll(selector).forEach(el => {
            if (props.includes('background')) el.style.background = colors.buttonBg;
            if (props.includes('borderColor')) el.style.borderColor = colors.border;
            if (props.includes('color')) el.style.color = colors.text;
        });
    });
}

// 辅助函数
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function adjustBrightness(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.max(0, Math.min(255, rgb.r + percent));
    const g = Math.max(0, Math.min(255, rgb.g + percent));
    const b = Math.max(0, Math.min(255, rgb.b + percent));
    return `#${[r,g,b].map(x => x.toString(16).padStart(2,'0')).join('')}`;
}

function rgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : hex;
}

// 导出模块
window.UIManager = {
    initControlMenu
};
