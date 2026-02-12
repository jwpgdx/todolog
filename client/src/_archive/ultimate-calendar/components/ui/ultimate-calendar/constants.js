import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const SCREEN_WIDTH = width;
export const COLUMN_WIDTH = width / 7;
// Rounding to avoid sub-pixel rendering artifacts which can cause gaps or misalignment
export const CELL_HEIGHT = Math.round(COLUMN_WIDTH);
export const WEEK_DAY_HEIGHT = 30;

export const THEME = {
    primary: '#00AAAF',
    bg: 'white',
    text: '#333',
    textGray: '#ccc',
    todayBg: '#e6f7f8',
    sunday: '#ff5e5e',
    saturday: '#5e5eff',
    selectedBg: '#00AAAF',
    selectedText: 'white',
};
