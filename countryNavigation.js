// ==================== 国家导航模块 ====================

let _countries = [];
let _loaded = false;

// 初始化导航
async function initNavigation(currentCountry) {
    if (!_loaded) {
        await _loadCountries();
        _loaded = true;
    }
    
    const config = _countries.find(c => c.name === currentCountry || c.code === currentCountry);
    const idx = config ? _countries.findIndex(c => c.code === config.code) : -1;
    
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    if (prevBtn) {
        if (idx > 0) {
            const prev = _countries[idx - 1];
            prevBtn.onclick = () => { window.location.href = `country.html?countryCode=${prev.code}`; };
            prevBtn.disabled = false;
        } else {
            prevBtn.disabled = true;
        }
    }

    if (nextBtn) {
        if (idx >= 0 && idx < _countries.length - 1) {
            const next = _countries[idx + 1];
            nextBtn.onclick = () => { window.location.href = `country.html?countryCode=${next.code}`; };
            nextBtn.disabled = false;
        } else {
            nextBtn.disabled = true;
        }
    }
    
    console.log('[NAV] Init:', { current: currentCountry, idx, total: _countries.length });
}

// 加载国家列表
async function _loadCountries() {
    try {
        const res = await fetch('/data/countries-config.json');
        const config = await res.json();
        
        _countries = Object.entries(config.countries || {}).map(([code, cfg]) => ({
            code,
            name: cfg.name || code,
            nameCN: cfg.nameCN || ''
        })).sort((a, b) => a.code.localeCompare(b.code));
        
        console.log('[NAV] Loaded:', _countries.map(c => `${c.code}:${c.name}`).join(', '));
    } catch (err) {
        console.error('[NAV] Error:', err);
        _countries = [];
    }
}

window.initNavigation = initNavigation;
