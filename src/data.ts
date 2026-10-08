export type RankingItem = {
  rank: number;
  name: string;
  displayName?: string;
  value: number | string;
  unit?: string;
  color?: string;
  height?: number;
  width?: number;
  depth?: number;
  x?: number;
  y?: number;
  z?: number;
  logo?: string;
};

export type RankingVideoProps = {
  title: string;
  items: RankingItem[];
  audioFile?: string;
  durationInFrames?: number;
  timeline?: TimelineSegment[];
};

export type TimelineSegment = {
  id: string;
  rank?: number;
  start: number;
  speechDuration: number;
  intervalDuration: number;
  duration: number;
  cameraMoveDelay?: number;
};

export const data: RankingItem[] = [
  { rank: 10, name: "利比亚", value: 480, unit: "" },
  { rank: 9, name: "俄罗斯", value: 740, unit: "亿桶" },
  { rank: 8, name: "美国", value: "约800", unit: "亿桶" },
  { rank: 7, name: "科威特", value: 1015, unit: "亿桶" },
  { rank: 6, name: "阿联酋", value: 1130, unit: "亿桶" },
  { rank: 5, name: "伊拉克", value: 1450, unit: "亿桶" },
  { rank: 4, name: "加拿大", value: 1630, unit: "亿桶" },
  { rank: 3, name: "伊朗", value: 2086, unit: "亿桶" },
  { rank: 2, name: "沙特阿拉伯", value: 2670, unit: "亿桶" },
  { rank: 1, name: "委内瑞拉", value: 3030, unit: "亿桶" }
];

export const defaultVideoProps: RankingVideoProps = {
  title: "世界排名",
  items: data,
};
