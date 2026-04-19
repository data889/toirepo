// Hardcoded toilet data for T3.5 visual verification.
// T5's toilet.list tRPC query will replace this with DB-sourced data,
// returning the same shape so MapCanvas needs no further changes.

import type { ToiletType } from '@/generated/prisma'

export interface MockToilet {
  id: string
  name: string
  nameJa: string
  nameEn: string
  type: ToiletType
  lat: number
  lng: number
  address: string
}

export const MOCK_TOILETS: MockToilet[] = [
  // === 东京站 & 丸之内 ===
  {
    id: 'mock-1',
    name: '东京站丸之内北口卫生间',
    nameJa: '東京駅 丸の内北口 トイレ',
    nameEn: 'Tokyo Station Marunouchi North',
    type: 'PUBLIC',
    lat: 35.682,
    lng: 139.7656,
    address: '东京都千代田区丸之内 1-9',
  },
  {
    id: 'mock-2',
    name: 'KITTE 丸之内 4F',
    nameJa: 'KITTE 丸の内 4F',
    nameEn: 'KITTE Marunouchi 4F',
    type: 'MALL',
    lat: 35.6793,
    lng: 139.764,
    address: '东京都千代田区丸之内 2-7-2',
  },

  // === 新宿 ===
  {
    id: 'mock-3',
    name: '新宿御苑前便利店',
    nameJa: '新宿御苑前 ファミリーマート',
    nameEn: 'Shinjuku-gyoen FamilyMart',
    type: 'KONBINI',
    lat: 35.6863,
    lng: 139.7099,
    address: '东京都新宿区新宿 1-11',
  },
  {
    id: 'mock-4',
    name: '伊势丹新宿本店 6F',
    nameJa: '伊勢丹新宿本店 6F',
    nameEn: 'Isetan Shinjuku 6F',
    type: 'MALL',
    lat: 35.6917,
    lng: 139.7039,
    address: '东京都新宿区新宿 3-14-1',
  },
  {
    id: 'mock-5',
    name: '新宿站南口咖啡厅',
    nameJa: '新宿駅南口 スタバ',
    nameEn: 'Shinjuku South Starbucks',
    type: 'PURCHASE',
    lat: 35.689,
    lng: 139.7006,
    address: '东京都新宿区新宿 3-38',
  },

  // === 涩谷 ===
  {
    id: 'mock-6',
    name: '涩谷 Scramble Square',
    nameJa: '渋谷スクランブルスクエア',
    nameEn: 'Shibuya Scramble Square',
    type: 'MALL',
    lat: 35.6586,
    lng: 139.702,
    address: '东京都涩谷区涩谷 2-24-12',
  },
  {
    id: 'mock-7',
    name: '涩谷区立宫下公园',
    nameJa: '渋谷区立宮下公園',
    nameEn: 'Miyashita Park',
    type: 'PUBLIC',
    lat: 35.6625,
    lng: 139.702,
    address: '东京都涩谷区神宫前 6-20',
  },
  {
    id: 'mock-8',
    name: '代代木公园公厕',
    nameJa: '代々木公園 公衆トイレ',
    nameEn: 'Yoyogi Park Public',
    type: 'PUBLIC',
    lat: 35.6716,
    lng: 139.6948,
    address: '东京都涩谷区代代木神园町 2-1',
  },

  // === 六本木 / 赤坂 ===
  {
    id: 'mock-9',
    name: '六本木之丘',
    nameJa: '六本木ヒルズ',
    nameEn: 'Roppongi Hills',
    type: 'MALL',
    lat: 35.6604,
    lng: 139.7292,
    address: '东京都港区六本木 6-10-1',
  },
  {
    id: 'mock-10',
    name: '东京中城咖啡店',
    nameJa: '東京ミッドタウン カフェ',
    nameEn: 'Tokyo Midtown Cafe',
    type: 'PURCHASE',
    lat: 35.6654,
    lng: 139.7311,
    address: '东京都港区赤坂 9-7',
  },

  // === 皇居 / 日比谷 ===
  {
    id: 'mock-11',
    name: '日比谷公园公厕',
    nameJa: '日比谷公園 公衆トイレ',
    nameEn: 'Hibiya Park Public',
    type: 'PUBLIC',
    lat: 35.6737,
    lng: 139.759,
    address: '东京都千代田区日比谷公园 1-6',
  },
  {
    id: 'mock-12',
    name: '皇居外苑便利店',
    nameJa: '皇居外苑 セブンイレブン',
    nameEn: 'Kokyo-gaien 7-Eleven',
    type: 'KONBINI',
    lat: 35.682,
    lng: 139.7571,
    address: '东京都千代田区皇居外苑 1-1',
  },

  // === 浅草 / 上野 ===
  {
    id: 'mock-13',
    name: '浅草寺仲见世通',
    nameJa: '浅草寺 仲見世通り',
    nameEn: 'Senso-ji Nakamise',
    type: 'PUBLIC',
    lat: 35.7115,
    lng: 139.7967,
    address: '东京都台东区浅草 1-36',
  },
  {
    id: 'mock-14',
    name: '雷门 Lawson',
    nameJa: '雷門 ローソン',
    nameEn: 'Kaminarimon Lawson',
    type: 'KONBINI',
    lat: 35.7109,
    lng: 139.7963,
    address: '东京都台东区雷门 2-18',
  },
  {
    id: 'mock-15',
    name: '上野公园公厕',
    nameJa: '上野公園 公衆トイレ',
    nameEn: 'Ueno Park Public',
    type: 'PUBLIC',
    lat: 35.7148,
    lng: 139.7732,
    address: '东京都台东区上野公园 5-20',
  },

  // === 银座 ===
  {
    id: 'mock-16',
    name: '银座 Six',
    nameJa: 'GINZA SIX',
    nameEn: 'GINZA SIX',
    type: 'MALL',
    lat: 35.6698,
    lng: 139.7635,
    address: '东京都中央区银座 6-10-1',
  },
  {
    id: 'mock-17',
    name: '银座 Tully Coffee',
    nameJa: '銀座 タリーズコーヒー',
    nameEn: 'Ginza Tullys',
    type: 'PURCHASE',
    lat: 35.6729,
    lng: 139.7634,
    address: '东京都中央区银座 5-4',
  },

  // === 秋叶原 / 神田 ===
  {
    id: 'mock-18',
    name: '秋叶原 Yodobashi',
    nameJa: '秋葉原 ヨドバシカメラ',
    nameEn: 'Akihabara Yodobashi',
    type: 'MALL',
    lat: 35.6992,
    lng: 139.7745,
    address: '东京都千代田区神田花冈町 1-1',
  },
  {
    id: 'mock-19',
    name: '秋叶原站前 7-Eleven',
    nameJa: '秋葉原駅前 セブンイレブン',
    nameEn: 'Akihabara Station 7-Eleven',
    type: 'KONBINI',
    lat: 35.6984,
    lng: 139.7731,
    address: '东京都千代田区外神田 1-16',
  },

  // === 品川 ===
  {
    id: 'mock-20',
    name: '品川站高轮口咖啡',
    nameJa: '品川駅 高輪口 カフェ',
    nameEn: 'Shinagawa West Cafe',
    type: 'PURCHASE',
    lat: 35.6284,
    lng: 139.7387,
    address: '东京都港区高轮 3-26',
  },
]
