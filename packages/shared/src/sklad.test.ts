import { describe, expect, it } from 'vitest';
import {
  clampShipmentQty,
  completionPercent,
  formatSize,
  indexStageCells,
  isBlankReceiveRow,
  stageCellKey,
  sumStageOutput,
  summariseOrderProgress,
  summariseReceiveRows,
} from './sklad';
import type { SkladLineProgress, SkladStageCell } from './types';

function line(partial: Partial<SkladLineProgress> & Pick<SkladLineProgress, 'lineId'>) {
  return {
    position: 1,
    readyDona: 0,
    defectDona: 0,
    shippedDona: 0,
    shippedKg: 0,
    remainingDona: 0,
    ...partial,
  } satisfies SkladLineProgress;
}

function cell(partial: Partial<SkladStageCell> & Pick<SkladStageCell, 'lineId' | 'stageId'>) {
  return {
    stageName: 'Bo‘yoqxona',
    stagePosition: 20,
    isFinal: false,
    entryCount: 1,
    ...partial,
  } satisfies SkladStageCell;
}

describe('isBlankReceiveRow', () => {
  it('treats an untouched row as blank', () => {
    expect(isBlankReceiveRow({})).toBe(true);
  });

  it('treats whitespace as blank — a tab left behind is not data', () => {
    expect(isBlankReceiveRow({ kod: '   ', name: '' })).toBe(true);
  });

  it('treats any real value as filled', () => {
    expect(isBlankReceiveRow({ dona: '0' })).toBe(false);
  });
});

describe('summariseReceiveRows', () => {
  it('counts only the rows that will be sent', () => {
    const totals = summariseReceiveRows([
      { netto: '37.18', dona: '125', totalAmount: '148.70' },
      {},
      { netto: '35.08', dona: '65', totalAmount: '192.94' },
      { kod: '   ' },
    ]);

    expect(totals.rowCount).toBe(2);
    expect(totals.dona).toBe(190);
    expect(totals.nettoKg).toBeCloseTo(72.26, 5);
    expect(totals.amount).toBeCloseTo(341.64, 5);
  });

  it('ignores a cell that will not parse rather than returning NaN', () => {
    const totals = summariseReceiveRows([
      { netto: '10', dona: '5' },
      { netto: '12kg', dona: 'oltita' },
    ]);

    // The unparseable row still counts as a row — it has been typed into —
    // but contributes nothing to the figures.
    expect(totals.rowCount).toBe(2);
    expect(totals.nettoKg).toBe(10);
    expect(totals.dona).toBe(5);
  });

  it('is zero across the board for an empty grid', () => {
    expect(summariseReceiveRows([{}, {}])).toEqual({
      rowCount: 0,
      nettoKg: 0,
      dona: 0,
      amount: 0,
    });
  });
});

describe('summariseOrderProgress', () => {
  it('adds up the order columns, treating an unplanned row as zero', () => {
    const totals = summariseOrderProgress([
      line({
        lineId: 'a',
        plannedDona: 1000,
        readyDona: 800,
        shippedDona: 600,
        remainingDona: 400,
      }),
      line({ lineId: 'b', readyDona: 50, shippedDona: 0, remainingDona: 0, defectDona: 7 }),
    ]);

    expect(totals).toEqual({
      planned: 1000,
      ready: 850,
      shipped: 600,
      remaining: 400,
      defect: 7,
    });
  });

  it('is all zeros for an order with no rows yet', () => {
    expect(summariseOrderProgress([])).toEqual({
      planned: 0,
      ready: 0,
      shipped: 0,
      remaining: 0,
      defect: 0,
    });
  });
});

describe('the stage grid', () => {
  const cells = [
    cell({ lineId: 'a', stageId: 'dye', qtyOut: 400 }),
    cell({ lineId: 'b', stageId: 'dye', qtyOut: 600 }),
    cell({ lineId: 'a', stageId: 'sew', qtyOut: null }),
  ];

  it('indexes cells by row and stage', () => {
    const index = indexStageCells(cells);
    expect(index.get(stageCellKey('b', 'dye'))?.qtyOut).toBe(600);
    expect(index.get(stageCellKey('b', 'sew'))).toBeUndefined();
  });

  it('sums a stage column, counting a cell nobody has filled as zero', () => {
    expect(sumStageOutput(cells, 'dye')).toBe(1000);
    expect(sumStageOutput(cells, 'sew')).toBe(0);
  });
});

describe('clampShipmentQty', () => {
  it('keeps a value inside the outstanding balance', () => {
    expect(clampShipmentQty('40', 100)).toBe('40');
    expect(clampShipmentQty('140', 100)).toBe('100');
  });

  it('refuses a negative — always a mis-key, never an intent', () => {
    expect(clampShipmentQty('-5', 100)).toBe('0');
  });

  it('leaves a cleared cell empty instead of filling it with 0', () => {
    expect(clampShipmentQty('', 100)).toBe('');
    expect(clampShipmentQty('   ', 100)).toBe('');
  });

  it('allows nothing against a row that is already fully despatched', () => {
    expect(clampShipmentQty('10', 0)).toBe('0');
    expect(clampShipmentQty('10', -3)).toBe('0');
  });
});

describe('formatSize', () => {
  it('writes a whole measurement without a decimal', () => {
    expect(formatSize(70, 130)).toBe('70x130');
  });

  it('keeps a real half', () => {
    expect(formatSize(70.5, 130)).toBe('70.5x130');
  });

  it('parses a numeric that arrived as a string, .0 and all', () => {
    expect(formatSize('70.0', '130.0')).toBe('70x130');
  });

  it('shows the one measurement it has', () => {
    expect(formatSize(70, null)).toBe('70');
    expect(formatSize(null, 130)).toBe('130');
  });

  it('says nothing rather than 0 for an unmeasured card', () => {
    expect(formatSize(null, null)).toBe('—');
    expect(formatSize(undefined, undefined)).toBe('—');
  });
});

describe('completionPercent', () => {
  it('rounds to a whole percent', () => {
    expect(completionPercent(1, 3)).toBe(33);
  });

  it('never divides by zero', () => {
    expect(completionPercent(5, 0)).toBe(0);
  });

  it('caps at 100 when more shipped than planned', () => {
    expect(completionPercent(120, 100)).toBe(100);
  });
});
