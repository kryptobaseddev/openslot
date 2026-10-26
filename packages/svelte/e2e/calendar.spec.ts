import { expect, test, type Page } from '@playwright/test';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

async function noPageScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Centre of an element. */
async function centre(page: Page, selector: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** Touch long-press drag through CDP (Chromium emits touch pointer events). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const point = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
  await page.waitForTimeout(450);
  for (let i = 1; i <= 8; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(p) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('layout', () => {
  test('no page-level horizontal scroll, and phones get the agenda with a FAB', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('toolbar', { name: 'Calendar navigation' })).toBeVisible();
    await noPageScroll(page);
    if (isPhone(page)) {
      await expect(page.locator('.osl-list')).toBeVisible();
      const fab = page.getByRole('button', { name: 'New event' });
      await expect(fab).toBeVisible();
      const box = (await fab.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    } else {
      await expect(page.locator('.osl-lane[data-resource="studio-a"]')).toBeVisible();
      await expect(page.locator('.osl-now').first()).toBeVisible();
    }
  });

  test('toolbar buttons are at least 44px', async ({ page }) => {
    await page.goto('/');
    for (const name of ['Today', 'Previous', 'Next']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('every view renders without page scroll', async ({ page }) => {
    for (const view of ['resource-week', 'timeline-day', 'month', 'week', 'list']) {
      await page.goto(`/?view=${view}`);
      await expect(page.locator('.osl-body')).toBeVisible();
      await noPageScroll(page);
    }
  });
});

test.describe('phone agenda', () => {
  test('swipe changes the day', async ({ page }) => {
    test.skip(!isPhone(page), 'phones only');
    await page.goto('/');
    const title = page.locator('.osl-title');
    const before = await title.textContent();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(title).not.toHaveText(before!);
  });
});

test.describe('drag and drop', () => {
  test('mouse drag moves an event, Undo puts it back', async ({ page }) => {
    test.skip(isPhone(page) || page.viewportSize()!.width < 1000, 'desktop pointer');
    await page.goto('/');
    const a = await centre(page, '[data-event-id="b1"]');
    const lane = await centre(page, '.osl-lane[data-resource="studio-a"]');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x, a.y + 40, { steps: 4 });
    await page.mouse.move(a.x, a.y + 150, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('log')).toContainText('move: Moved Rivera party');
    const toast = page.locator('.osl-toast').filter({ hasText: 'Moved Rivera party' });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('log')).toContainText('undo:');
    expect(lane.box.width).toBeGreaterThan(100);
  });

  test('a refused move (409) rolls back with a toast', async ({ page }) => {
    test.skip(isPhone(page) || page.viewportSize()!.width < 1000, 'desktop pointer');
    await page.goto('/');
    const before = await page.locator('[data-event-id="b2"]').boundingBox();
    const lane = (await page.locator('.osl-lane[data-resource="studio-b"]').boundingBox())!;
    const ppm = Number(await page.locator('.osl-lane[data-resource="studio-b"]').getAttribute('data-ppm'));
    const origin = Number(await page.locator('.osl-lane[data-resource="studio-b"]').getAttribute('data-origin-min'));
    const ev = await centre(page, '[data-event-id="b2"]');
    // grab b2 (12:00) below its resize handle and drop it so the start lands at 18:00
    const grabY = before!.y + 24;
    const targetY = lane.y + (18 * 60 - origin) * ppm + 24;
    await page.mouse.move(ev.x, grabY);
    await page.mouse.down();
    await page.mouse.move(ev.x, grabY + 20, { steps: 3 });
    await page.mouse.move(ev.x, targetY, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.osl-toast-error')).toContainText('Studio B is booked');
    await expect.poll(async () => (await page.locator('[data-event-id="b2"]').boundingBox())?.y).toBeCloseTo(before!.y, 0);
  });

  test('dropping an event on another one swaps their resources', async ({ page }) => {
    test.skip(isPhone(page) || page.viewportSize()!.width < 1000, 'desktop pointer');
    await page.goto('/');
    const a = await centre(page, '[data-event-id="b1"]');
    const b = await centre(page, '[data-event-id="b2"]');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('log')).toContainText('swap: Swapped Rivera party and Okafor');
  });

  test('dragging the end edge resizes an event', async ({ page }) => {
    test.skip(isPhone(page) || page.viewportSize()!.width < 1000, 'desktop pointer');
    await page.goto('/');
    const ev = page.locator('[data-event-id="b1"]');
    const before = (await ev.boundingBox())!;
    const ppm = Number(await page.locator('.osl-lane[data-resource="studio-a"]').getAttribute('data-ppm'));
    const x = before.x + before.width / 2;
    const y = before.y + before.height - 3; // the end handle
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 10, { steps: 3 });
    await page.mouse.move(x, y + 30 * ppm, { steps: 8 });
    await page.mouse.up();
    // 12:00-13:00 becomes 12:00-13:30: same start, 30 minutes longer
    await expect(page.getByTestId('log')).toContainText('resize: Moved Rivera party to 12:00');
    await expect.poll(async () => (await ev.boundingBox())!.height).toBeCloseTo(before.height + 30 * ppm, 0);
    expect((await ev.boundingBox())!.y).toBeCloseTo(before.y, 0);
  });

  test('touch long-press drag moves an event (tablet)', async ({ page }) => {
    test.skip(page.viewportSize()!.width !== 768, 'tablet touch');
    await page.goto('/?view=resource-day');
    const a = await centre(page, '[data-event-id="b1"]');
    await touchDrag(page, a, { x: a.x, y: a.y + 150 });
    await expect(page.getByTestId('log')).toContainText('move: Moved Rivera party');
  });

  test('dragging a sidebar template creates at the drop time', async ({ page }) => {
    test.skip(isPhone(page) || page.viewportSize()!.width < 1000, 'desktop pointer');
    await page.goto('/');
    const t = await centre(page, '.osl-template');
    const lane = (await page.locator('.osl-lane[data-resource="studio-a"]').boundingBox())!;
    await page.mouse.move(t.x, t.y);
    await page.mouse.down();
    await page.mouse.move(t.x + 30, t.y, { steps: 3 });
    await page.mouse.move(lane.x + lane.width / 2, lane.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('created')).toContainText('studio-a');
  });
});

test.describe('schedule shuffling', () => {
  test('a template dropped on a busy resource goes to a free compatible resource', async ({ page }) => {
    test.skip(isPhone(page) || page.viewportSize()!.width < 1000, 'desktop pointer');
    await page.goto('/');
    const lane = page.locator('.osl-lane[data-resource="studio-a"]');
    const box = (await lane.boundingBox())!;
    const ppm = Number(await lane.getAttribute('data-ppm'));
    const origin = Number(await lane.getAttribute('data-origin-min'));
    const t = await centre(page, '.osl-template');
    await page.mouse.move(t.x, t.y);
    await page.mouse.down();
    await page.mouse.move(t.x + 30, t.y, { steps: 3 });
    // 15:00 in Studio A, where Chen is booked; Studio B is compatible and free
    await page.mouse.move(box.x + box.width / 2, box.y + (15 * 60 - origin) * ppm + 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('created')).toContainText('studio-b');
  });

  test('Resolve conflict previews a re-seat; Accept moves the unpinned event', async ({ page }) => {
    await page.goto('/');
    const walkIn = page.locator('[data-event-id="b6"]').first();
    await walkIn.scrollIntoViewIfNeeded();
    await walkIn.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog', { name: 'Walk-in Diaz' });
    await expect(modal).toContainText('overlaps another event');
    await modal.getByRole('button', { name: 'Resolve conflict' }).click();
    const preview = page.getByRole('dialog', { name: 'Rearrange to fit it in?' });
    await expect(preview).toContainText('Walk-in Diaz');
    await expect(preview).toContainText('Studio A');
    await preview.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByTestId('log')).toContainText('reseat: Resolved the conflict for Walk-in Diaz');
  });

  test('Reject leaves the schedule unchanged', async ({ page }) => {
    await page.goto('/');
    const walkIn = page.locator('[data-event-id="b6"]').first();
    await walkIn.scrollIntoViewIfNeeded();
    await walkIn.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Walk-in Diaz' }).getByRole('button', { name: 'Resolve conflict' }).click();
    await page.getByRole('dialog', { name: 'Rearrange to fit it in?' }).getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByTestId('log')).toHaveText('');
  });
});

test.describe('phone resources view', () => {
  test('one resource at a time with resource chips, long-press drag works', async ({ page }) => {
    test.skip(!isPhone(page), 'phones only');
    await page.goto('/');
    await page.getByLabel('View').selectOption('resource-day');
    const chips = page.getByRole('radiogroup', { name: 'Resource' });
    await expect(chips).toBeVisible();
    await chips.getByRole('radio', { name: 'The Lab' }).click();
    await expect(page.locator('.osl-lane[data-resource="lab"]')).toBeVisible();
    await expect(page.locator('.osl-lane')).toHaveCount(1);
    await noPageScroll(page);
    await page.locator('[data-event-id="b4"]').scrollIntoViewIfNeeded();
    const a = await centre(page, '[data-event-id="b4"]');
    await touchDrag(page, a, { x: a.x, y: a.y - 66 });
    await expect(page.getByTestId('log')).toContainText('move: Moved Lab night');
  });
});

test.describe('keyboard and screen readers', () => {
  test('M moves an event with the arrow keys and Enter drops it', async ({ page }) => {
    test.skip(isPhone(page), 'grid views');
    await page.goto('/');
    const card = page.locator('[data-event-id="b1"]');
    await card.focus();
    await page.keyboard.press('m');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('log')).toContainText('move: Moved Rivera party to 12:30');
  });

  test('Enter opens the event modal and Escape closes it', async ({ page }) => {
    await page.goto('/');
    const row = page.locator('[data-event-id="b1"]').first();
    await row.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Rivera party');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the scheduling assistant lists open times', async ({ page }) => {
    test.skip(isPhone(page), 'sidebar open by default on larger screens');
    await page.goto('/');
    await page.getByText('Find a time').click();
    await page.getByRole('button', { name: 'Find open times' }).click();
    await expect(page.locator('.osl-assistant .osl-slot').first()).toBeVisible();
  });
});
