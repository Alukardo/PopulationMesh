// IDW (反距离加权插值) Web Worker
// 用于在后台线程计算地形高度图，避免阻塞主线程

self.onmessage = function(e) {
    const { 
        projectedData, 
        gridSize, 
        mapMinX, mapMaxX, mapMinY, mapMaxY, 
        inCountryMap,
        searchRadius 
    } = e.data;
    
    const width = mapMaxX - mapMinX;
    const height = mapMaxY - mapMinY;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    
    const heightMap = [];
    let processedCount = 0;
    const totalPoints = (gridSize + 1) * (gridSize + 1);
    
    // 遍历所有网格点
    for (let j = 0; j <= gridSize; j++) {
        const row = [];
        for (let i = 0; i <= gridSize; i++) {
            const gridX = mapMinX + i * cellWidth;
            const gridY = mapMinY + j * cellHeight;
            const isInCountry = inCountryMap[j]?.[i] || false;
            
            if (!isInCountry) {
                row.push(0);
                continue;
            }
            
            // IDW 插值计算
            let totalWeight = 0;
            let weightedHeight = 0;
            let minDist = Infinity;
            let nearestHeight = 0;
            
            for (let k = 0; k < projectedData.length; k++) {
                const p = projectedData[k];
                const dx = p.x - gridX;
                const dy = p.y - gridY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < searchRadius) {
                    const weight = 1 / (dist * dist + 0.1);
                    weightedHeight += p.height * weight;
                    totalWeight += weight;
                }
                
                if (dist < minDist) {
                    minDist = dist;
                    nearestHeight = p.height;
                }
            }
            
            let h = 0;
            if (totalWeight > 0) {
                h = weightedHeight / totalWeight;
            } else if (isInCountry) {
                h = nearestHeight * 0.5;
            }
            
            h = Math.max(0, h);
            row.push(h);
            
            // 定期报告进度
            processedCount++;
            if (processedCount % 1000 === 0) {
                self.postMessage({ 
                    type: 'progress', 
                    progress: (processedCount / totalPoints) * 100 
                });
            }
        }
        heightMap.push(row);
    }
    
    // 计算完成，返回结果
    self.postMessage({ 
        type: 'complete', 
        heightMap: heightMap 
    });
};
