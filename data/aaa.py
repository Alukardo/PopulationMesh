import pandas as pd
import numpy as np
from osgeo import gdal, osr
import json

# 读取CSV数据
df = pd.read_csv('D:/Graduation project/data/aus_pd_2020_1km_ASCII_XYZ.csv')


# 读取TIFF文件获取地理信息
dataset = gdal.Open('D:/Graduation project/data/aus_pd_2020_1km.tif')
geotransform = dataset.GetGeoTransform()
projection = dataset.GetProjection()

# 创建空间参考对象
source_srs = osr.SpatialReference()
source_srs.ImportFromWkt(projection)

# 输出地理信息到JSON文件供前端使用
geo_info = {
    'geotransform': geotransform,
    'projection': projection,
    'x_min': df['X'].min(),
    'x_max': df['X'].max(),
    'y_min': df['Y'].min(),
    'y_max': df['Y'].max(),
    'z_min': df['Z'].min(),
    'z_max': df['Z'].max()
}

# 保存地理信息
with open('/data/geo_info/AUS_geo_info.json', 'w') as f:
    json.dump(geo_info, f)

# 对数据进行采样以减少点数量
# 对于 Three.js 可视化，我们不需要所有数据点
# 目标：约 20-50 万个点（足够展示细节但不会导致浏览器崩溃）
total_points = len(df)
print(f"原始数据点数: {total_points}")

if total_points > 500000:
    # 如果数据点超过50万，采样到约20-50万
    # 对于超大数据集（>1000万），采样到约30-50万
    if total_points > 10000000:
        sample_size = min(500000, max(300000, int(total_points * 0.03)))
    else:
        sample_size = min(500000, max(200000, int(total_points * 0.05)))
    sampled_df = df.sample(n=sample_size, random_state=42)
    print(f"数据点过多，采样到 {sample_size} 个点 (采样率: {sample_size/total_points*100:.2f}%)")
else:
    # 如果数据点较少，使用全部数据
    sampled_df = df
    print(f"使用全部数据点: {total_points}")

# 保存采样后的数据供Three.js使用
# 使用紧凑格式：不添加额外空格，减少文件大小
sampled_data = {
    'positions': sampled_df[['X', 'Y', 'Z']].values.tolist()
}

print(f"正在保存 JSON 文件，包含 {len(sampled_df)} 个数据点...")
with open('../populationData/AUS_population_data.json', 'w') as f:
    json.dump(sampled_data, f, separators=(',', ':'))  # 紧凑格式，无额外空格

print(f"JSON 文件已保存")

print("数据转换完成")
print(f"原始数据点数: {len(df)}")
print(f"采样后数据点数: {len(sampled_df)}")
