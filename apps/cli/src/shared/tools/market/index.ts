import {
  getOHLCTool,
  getSMATool,
  getEMATool,
  getRSITool,
  getMACDTool,
  getBollingerTool,
} from './tools';

/**
 * All market tools for export.
 */
export const marketTools = {
  getOHLC: getOHLCTool,
  getSMA: getSMATool,
  getEMA: getEMATool,
  getRSI: getRSITool,
  getMACD: getMACDTool,
  getBollinger: getBollingerTool,
};
