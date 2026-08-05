import type { FieldMeta, DataType } from '@/types'
import { FieldKind } from '@/types'

export interface SampleDataset {
  id: string
  name: string
  description: string
  icon: string
  rows: Record<string, any>[]
}

/**
 * 内置示例数据集 —— 无需上传文件，直接点击即可加载
 */
export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'sales',
    name: '销售数据',
    description: '地区×产品×月份的销售、数量、利润（32行）',
    icon: '📈',
    rows: [
      { region: '华东', product: '手机', month: '2024-01', sales: 120000, quantity: 450, profit: 36000 },
      { region: '华东', product: '电脑', month: '2024-01', sales: 95000, quantity: 180, profit: 28500 },
      { region: '华北', product: '手机', month: '2024-01', sales: 88000, quantity: 320, profit: 26400 },
      { region: '华北', product: '电脑', month: '2024-01', sales: 72000, quantity: 140, profit: 21600 },
      { region: '华南', product: '手机', month: '2024-01', sales: 105000, quantity: 380, profit: 31500 },
      { region: '华南', product: '电脑', month: '2024-01', sales: 68000, quantity: 130, profit: 20400 },
      { region: '西南', product: '手机', month: '2024-01', sales: 56000, quantity: 200, profit: 16800 },
      { region: '西南', product: '电脑', month: '2024-01', sales: 42000, quantity: 80, profit: 12600 },
      { region: '华东', product: '手机', month: '2024-02', sales: 135000, quantity: 500, profit: 40500 },
      { region: '华东', product: '电脑', month: '2024-02', sales: 102000, quantity: 195, profit: 30600 },
      { region: '华北', product: '手机', month: '2024-02', sales: 92000, quantity: 335, profit: 27600 },
      { region: '华北', product: '电脑', month: '2024-02', sales: 78000, quantity: 150, profit: 23400 },
      { region: '华南', product: '手机', month: '2024-02', sales: 118000, quantity: 425, profit: 35400 },
      { region: '华南', product: '电脑', month: '2024-02', sales: 75000, quantity: 145, profit: 22500 },
      { region: '西南', product: '手机', month: '2024-02', sales: 62000, quantity: 225, profit: 18600 },
      { region: '西南', product: '电脑', month: '2024-02', sales: 48000, quantity: 90, profit: 14400 },
      { region: '华东', product: '手机', month: '2024-03', sales: 142000, quantity: 530, profit: 42600 },
      { region: '华东', product: '电脑', month: '2024-03', sales: 108000, quantity: 205, profit: 32400 },
      { region: '华北', product: '手机', month: '2024-03', sales: 98000, quantity: 360, profit: 29400 },
      { region: '华北', product: '电脑', month: '2024-03', sales: 82000, quantity: 160, profit: 24600 },
      { region: '华南', product: '手机', month: '2024-03', sales: 125000, quantity: 450, profit: 37500 },
      { region: '华南', product: '电脑', month: '2024-03', sales: 80000, quantity: 155, profit: 24000 },
      { region: '西南', product: '手机', month: '2024-03', sales: 68000, quantity: 245, profit: 20400 },
      { region: '西南', product: '电脑', month: '2024-03', sales: 52000, quantity: 100, profit: 15600 },
      { region: '华东', product: '手机', month: '2024-04', sales: 155000, quantity: 580, profit: 46500 },
      { region: '华东', product: '电脑', month: '2024-04', sales: 115000, quantity: 220, profit: 34500 },
      { region: '华北', product: '手机', month: '2024-04', sales: 105000, quantity: 385, profit: 31500 },
      { region: '华北', product: '电脑', month: '2024-04', sales: 88000, quantity: 170, profit: 26400 },
      { region: '华南', product: '手机', month: '2024-04', sales: 132000, quantity: 475, profit: 39600 },
      { region: '华南', product: '电脑', month: '2024-04', sales: 85000, quantity: 165, profit: 25500 },
      { region: '西南', product: '手机', month: '2024-04', sales: 72000, quantity: 260, profit: 21600 },
      { region: '西南', product: '电脑', month: '2024-04', sales: 56000, quantity: 110, profit: 16800 },
    ],
  },
  {
    id: 'movies',
    name: '电影评分',
    description: '电影类型×年份的票房与评分（24行）',
    icon: '🎬',
    rows: [
      { title: '星际穿越', genre: '科幻', year: 2014, rating: 8.7, boxOffice: 731, duration: 169 },
      { title: '盗梦空间', genre: '科幻', year: 2010, rating: 8.8, boxOffice: 836, duration: 148 },
      { title: '银翼杀手2049', genre: '科幻', year: 2017, rating: 8.0, boxOffice: 260, duration: 164 },
      { title: '沙丘', genre: '科幻', year: 2021, rating: 7.9, boxOffice: 402, duration: 155 },
      { title: '流浪地球', genre: '科幻', year: 2019, rating: 7.9, boxOffice: 700, duration: 125 },
      { title: '阿凡达', genre: '科幻', year: 2009, rating: 8.7, boxOffice: 2923, duration: 162 },
      { title: '泰坦尼克号', genre: '爱情', year: 1997, rating: 9.4, boxOffice: 2257, duration: 194 },
      { title: '恋恋笔记本', genre: '爱情', year: 2004, rating: 8.5, boxOffice: 115, duration: 123 },
      { title: '怦然心动', genre: '爱情', year: 2010, rating: 9.1, boxOffice: 35, duration: 90 },
      { title: '爱乐之城', genre: '爱情', year: 2016, rating: 8.3, boxOffice: 447, duration: 128 },
      { title: '寄生虫', genre: '剧情', year: 2019, rating: 8.7, boxOffice: 263, duration: 132 },
      { title: '肖申克的救赎', genre: '剧情', year: 1994, rating: 9.7, boxOffice: 58, duration: 142 },
      { title: '阿甘正传', genre: '剧情', year: 1994, rating: 9.5, boxOffice: 678, duration: 142 },
      { title: '摔跤吧爸爸', genre: '剧情', year: 2016, rating: 9.0, boxOffice: 300, duration: 161 },
      { title: '我不是药神', genre: '剧情', year: 2018, rating: 9.0, boxOffice: 455, duration: 117 },
      { title: '让子弹飞', genre: '动作', year: 2010, rating: 9.0, boxOffice: 111, duration: 132 },
      { title: '红海行动', genre: '动作', year: 2018, rating: 8.3, boxOffice: 579, duration: 138 },
      { title: '战狼2', genre: '动作', year: 2017, rating: 7.1, boxOffice: 870, duration: 123 },
      { title: '速度与激情7', genre: '动作', year: 2015, rating: 8.1, boxOffice: 1516, duration: 137 },
      { title: '复仇者联盟4', genre: '动作', year: 2019, rating: 8.5, boxOffice: 2798, duration: 181 },
      { title: '千与千寻', genre: '动画', year: 2001, rating: 9.4, boxOffice: 395, duration: 125 },
      { title: '你的名字', genre: '动画', year: 2016, rating: 8.5, boxOffice: 358, duration: 106 },
      { title: '哪吒之魔童降世', genre: '动画', year: 2019, rating: 8.4, boxOffice: 726, duration: 110 },
      { title: '疯狂动物城', genre: '动画', year: 2016, rating: 9.2, boxOffice: 1023, duration: 108 },
    ],
  },
  {
    id: 'population',
    name: '城市人口',
    description: '中国主要城市的人口、GDP、面积（20行）',
    icon: '🏙️',
    rows: [
      { city: '上海', province: '上海', population: 2487, gdp: 43215, area: 6340, tier: '一线' },
      { city: '北京', province: '北京', population: 2188, gdp: 40269, area: 16410, tier: '一线' },
      { city: '深圳', province: '广东', population: 1756, gdp: 30664, area: 1997, tier: '一线' },
      { city: '广州', province: '广东', population: 1881, gdp: 28232, area: 7434, tier: '一线' },
      { city: '成都', province: '四川', population: 2126, gdp: 19917, area: 14335, tier: '新一线' },
      { city: '杭州', province: '浙江', population: 1238, gdp: 18100, area: 16850, tier: '新一线' },
      { city: '武汉', province: '湖北', population: 1374, gdp: 17716, area: 8569, tier: '新一线' },
      { city: '南京', province: '江苏', population: 942, gdp: 16908, area: 6587, tier: '新一线' },
      { city: '重庆', province: '重庆', population: 3212, gdp: 27894, area: 82400, tier: '新一线' },
      { city: '苏州', province: '江苏', population: 1275, gdp: 23958, area: 8657, tier: '新一线' },
      { city: '西安', province: '陕西', population: 1295, gdp: 11487, area: 10752, tier: '新一线' },
      { city: '长沙', province: '湖南', population: 1024, gdp: 13966, area: 11819, tier: '新一线' },
      { city: '青岛', province: '山东', population: 1034, gdp: 14921, area: 11293, tier: '新一线' },
      { city: '郑州', province: '河南', population: 1283, gdp: 12935, area: 7567, tier: '新一线' },
      { city: '宁波', province: '浙江', population: 954, gdp: 14595, area: 9816, tier: '新一线' },
      { city: '昆明', province: '云南', population: 846, gdp: 7223, area: 21013, tier: '二线' },
      { city: '大连', province: '辽宁', population: 745, gdp: 8430, area: 13237, tier: '二线' },
      { city: '厦门', province: '福建', population: 516, gdp: 7803, area: 1701, tier: '二线' },
      { city: '福州', province: '福建', population: 842, gdp: 12308, area: 11968, tier: '二线' },
      { city: '合肥', province: '安徽', population: 947, gdp: 12013, area: 11445, tier: '新一线' },
    ],
  },
  {
    id: 'weather',
    name: '气温数据',
    description: '城市月度气温与降水量（12月×4城=48行）',
    icon: '🌡️',
    rows: [
      { city: '北京', month: '2024-01', tempAvg: -3.1, tempMax: 2.8, tempMin: -8.5, rainfall: 3 },
      { city: '上海', month: '2024-01', tempAvg: 5.2, tempMax: 9.5, tempMin: 1.8, rainfall: 45 },
      { city: '广州', month: '2024-01', tempAvg: 14.5, tempMax: 18.2, tempMin: 10.8, rainfall: 78 },
      { city: '成都', month: '2024-01', tempAvg: 7.1, tempMax: 11.3, tempMin: 3.5, rainfall: 12 },
      { city: '北京', month: '2024-02', tempAvg: 0.8, tempMax: 7.2, tempMin: -4.9, rainfall: 6 },
      { city: '上海', month: '2024-02', tempAvg: 7.8, tempMax: 12.1, tempMin: 4.2, rainfall: 58 },
      { city: '广州', month: '2024-02', tempAvg: 16.2, tempMax: 20.5, tempMin: 12.5, rainfall: 82 },
      { city: '成都', month: '2024-02', tempAvg: 9.8, tempMax: 14.0, tempMin: 5.8, rainfall: 18 },
      { city: '北京', month: '2024-03', tempAvg: 6.5, tempMax: 13.8, tempMin: 0.2, rainfall: 9 },
      { city: '上海', month: '2024-03', tempAvg: 11.2, tempMax: 16.0, tempMin: 7.0, rainfall: 92 },
      { city: '广州', month: '2024-03', tempAvg: 19.5, tempMax: 23.8, tempMin: 15.8, rainfall: 105 },
      { city: '成都', month: '2024-03', tempAvg: 14.2, tempMax: 19.0, tempMin: 9.8, rainfall: 28 },
      { city: '北京', month: '2024-04', tempAvg: 14.2, tempMax: 21.5, tempMin: 7.5, rainfall: 21 },
      { city: '上海', month: '2024-04', tempAvg: 16.8, tempMax: 21.8, tempMin: 12.2, rainfall: 110 },
      { city: '广州', month: '2024-04', tempAvg: 23.8, tempMax: 27.5, tempMin: 20.2, rainfall: 180 },
      { city: '成都', month: '2024-04', tempAvg: 18.5, tempMax: 24.0, tempMin: 13.5, rainfall: 55 },
      { city: '北京', month: '2024-05', tempAvg: 20.5, tempMax: 27.8, tempMin: 13.5, rainfall: 34 },
      { city: '上海', month: '2024-05', tempAvg: 21.8, tempMax: 26.5, tempMin: 17.2, rainfall: 125 },
      { city: '广州', month: '2024-05', tempAvg: 26.8, tempMax: 30.5, tempMin: 23.2, rainfall: 290 },
      { city: '成都', month: '2024-05', tempAvg: 22.5, tempMax: 27.8, tempMin: 17.5, rainfall: 85 },
      { city: '北京', month: '2024-06', tempAvg: 25.2, tempMax: 32.0, tempMin: 18.5, rainfall: 78 },
      { city: '上海', month: '2024-06', tempAvg: 25.8, tempMax: 29.5, tempMin: 22.0, rainfall: 180 },
      { city: '广州', month: '2024-06', tempAvg: 28.5, tempMax: 32.8, tempMin: 25.0, rainfall: 320 },
      { city: '成都', month: '2024-06', tempAvg: 25.2, tempMax: 30.0, tempMin: 21.0, rainfall: 115 },
      { city: '北京', month: '2024-07', tempAvg: 27.5, tempMax: 33.5, tempMin: 22.0, rainfall: 185 },
      { city: '上海', month: '2024-07', tempAvg: 29.2, tempMax: 33.8, tempMin: 25.0, rainfall: 155 },
      { city: '广州', month: '2024-07', tempAvg: 29.8, tempMax: 34.2, tempMin: 25.5, rainfall: 260 },
      { city: '成都', month: '2024-07', tempAvg: 26.8, tempMax: 31.5, tempMin: 22.5, rainfall: 225 },
      { city: '北京', month: '2024-08', tempAvg: 26.5, tempMax: 32.5, tempMin: 21.0, rainfall: 165 },
      { city: '上海', month: '2024-08', tempAvg: 29.0, tempMax: 33.5, tempMin: 25.0, rainfall: 142 },
      { city: '广州', month: '2024-08', tempAvg: 29.5, tempMax: 34.0, tempMin: 25.2, rainfall: 235 },
      { city: '成都', month: '2024-08', tempAvg: 26.2, tempMax: 31.0, tempMin: 22.0, rainfall: 210 },
      { city: '北京', month: '2024-09', tempAvg: 21.8, tempMax: 28.0, tempMin: 15.5, rainfall: 48 },
      { city: '上海', month: '2024-09', tempAvg: 24.8, tempMax: 28.8, tempMin: 21.0, rainfall: 135 },
      { city: '广州', month: '2024-09', tempAvg: 28.2, tempMax: 32.5, tempMin: 24.0, rainfall: 195 },
      { city: '成都', month: '2024-09', tempAvg: 22.5, tempMax: 27.0, tempMin: 18.5, rainfall: 125 },
      { city: '北京', month: '2024-10', tempAvg: 14.2, tempMax: 21.0, tempMin: 7.8, rainfall: 22 },
      { city: '上海', month: '2024-10', tempAvg: 19.2, tempMax: 23.5, tempMin: 15.0, rainfall: 68 },
      { city: '广州', month: '2024-10', tempAvg: 24.5, tempMax: 29.0, tempMin: 20.2, rainfall: 88 },
      { city: '成都', month: '2024-10', tempAvg: 17.5, tempMax: 22.0, tempMin: 13.5, rainfall: 45 },
      { city: '北京', month: '2024-11', tempAvg: 5.8, tempMax: 12.5, tempMin: 0.0, rainfall: 8 },
      { city: '上海', month: '2024-11', tempAvg: 13.8, tempMax: 18.0, tempMin: 9.8, rainfall: 52 },
      { city: '广州', month: '2024-11', tempAvg: 19.8, tempMax: 24.5, tempMin: 15.5, rainfall: 42 },
      { city: '成都', month: '2024-11', tempAvg: 12.8, tempMax: 17.5, tempMin: 8.5, rainfall: 18 },
      { city: '北京', month: '2024-12', tempAvg: -1.2, tempMax: 4.5, tempMin: -6.5, rainfall: 2 },
      { city: '上海', month: '2024-12', tempAvg: 7.2, tempMax: 11.5, tempMin: 3.2, rainfall: 38 },
      { city: '广州', month: '2024-12', tempAvg: 15.2, tempMax: 19.8, tempMin: 10.8, rainfall: 35 },
      { city: '成都', month: '2024-12', tempAvg: 7.8, tempMax: 12.5, tempMin: 3.5, rainfall: 8 },
    ],
  },
  {
    id: 'regions',
    name: '区域信息',
    description: '区域人口、面积、消费水平（4行，可与销售数据关联）',
    icon: '🗺️',
    rows: [
      { region: '华东', population: 16000, area: 21, consumeLevel: '高', cities: 5 },
      { region: '华北', population: 12000, area: 42, consumeLevel: '中', cities: 4 },
      { region: '华南', population: 14000, area: 33, consumeLevel: '高', cities: 4 },
      { region: '西南', population: 9000, area: 118, consumeLevel: '中', cities: 3 },
    ],
  },
]

/**
 * 从数据行推断字段类型
 */
export function inferFieldsFromRows(rows: Record<string, any>[]): FieldMeta[] {
  if (rows.length === 0) return []

  const fieldNames = Object.keys(rows[0])
  return fieldNames.map((name) => {
    const values = rows.slice(0, 100).map((r) => r[name]).filter((v) => v != null && v !== '')
    const sample = values.slice(0, 5).map(String)

    let dataType: DataType = 'string'
    let kind = FieldKind.Dimension

    if (values.length > 0) {
      const firstVal = values[0]
      if (typeof firstVal === 'number' || /^-?\d+(\.\d+)?$/.test(String(firstVal))) {
        dataType = 'number'
        kind = FieldKind.Measure
      } else if (/^\d{4}-\d{2}-\d{2}/.test(String(firstVal))) {
        dataType = 'date'
        kind = FieldKind.Dimension
      }
    }

    return { name, dataType, kind, sample }
  })
}
