import {
  NOTIFICATION_TRANSLATIONS,
  renderNotification as renderWithIcuSpaces,
} from '../../../../src/modules/notifications/notification-translations';

/** ICU puts thin and no-break spaces into ranges and amounts; compare them as plain spaces. */
const renderNotification = (...args: Parameters<typeof renderWithIcuSpaces>) => {
  const { title, message } = renderWithIcuSpaces(...args);
  return { title: title.replace(/\s/g, ' '), message: message.replace(/\s/g, ' ') };
};

describe('renderNotification', () => {
  const now = new Date('2026-10-15T09:00:00Z');
  const q3 = {
    period: { kind: 'taxPeriod', start: '2026-07-01', end: '2026-09-30' },
    range: { kind: 'dateRange', start: '2026-07-01', end: '2026-09-30' },
    dueDate: { kind: 'date', value: '2026-10-12' },
  } as const;

  it('writes a VAT reminder with the quarter and human dates, not ISO', () => {
    expect(renderNotification('en', 'tax.deadline.vat', q3, now)).toEqual({
      title: 'Q3 VAT return due soon',
      message: 'Q3 VAT return (Jul 1 – Sep 30) is due Oct 12.',
    });
    expect(renderNotification('en', 'tax.deadline.vat.overdue', q3, now)).toEqual({
      title: 'Q3 VAT return overdue',
      message: "Was due Oct 12 and isn't filed.",
    });
  });

  it('names a monthly period by its month and adds the year only when it is not this one', () => {
    const september = renderNotification(
      'en',
      'tax.deadline.vat',
      {
        period: { kind: 'taxPeriod', start: '2026-09-01', end: '2026-09-30' },
        range: { kind: 'dateRange', start: '2026-09-01', end: '2026-09-30' },
        dueDate: { kind: 'date', value: '2026-10-10' },
      },
      now,
    );
    expect(september.title).toBe('September VAT return due soon');

    const lastYear = renderNotification(
      'en',
      'tax.deadline.vat.overdue',
      {
        period: { kind: 'taxPeriod', start: '2025-10-01', end: '2025-12-31' },
        dueDate: { kind: 'date', value: '2026-02-10' },
      },
      now,
    );
    expect(lastYear).toEqual({
      title: 'Q4 2025 VAT return overdue',
      message: "Was due Feb 10 and isn't filed.",
    });
  });

  it('formats dates in the recipient locale', () => {
    const { title, message } = renderNotification('de', 'tax.deadline.vat', q3, now);
    expect(title).toBe('USt-Voranmeldung Q3 bald fällig');
    expect(message).toContain('ist am 12. Okt. fällig');
    expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // The abbreviated month's dot doubles as the full stop.
    expect(renderNotification('ru', 'tax.deadline.vat', q3, now).message).toBe(
      'Декларацию по НДС за 3-й квартал (1 июл. – 30 сент.) нужно подать до 12 окт.',
    );
  });

  it('lists upcoming charges with money in the locale format', () => {
    const charges = {
      charges: {
        kind: 'charges',
        items: [
          { name: 'Dropbox', amount: '11.99', currency: 'EUR' },
          { name: 'Adobe Creative Cloud', amount: 66.45, currency: 'EUR' },
        ],
      },
    } as const;
    expect(renderNotification('en', 'subscription.upcoming', charges, now).message).toBe(
      'Dropbox €11.99 and Adobe Creative Cloud €66.45 are due soon',
    );
    expect(renderNotification('de', 'subscription.upcoming', charges, now).message).toBe(
      'Dropbox 11,99 € und Adobe Creative Cloud 66,45 € werden bald abgebucht',
    );
  });

  it('names the country instead of its code in the official-rates notice', () => {
    expect(
      renderNotification('en', 'tax.rates.official', { country: { kind: 'region', code: 'DE' } }, now)
        .message,
    ).toBe('Official VAT rates for Germany differ from yours. Review them in tax settings.');
  });

  it('says how much is owed and since when for an overdue payable', () => {
    expect(
      renderNotification(
        'en',
        'payable.overdue',
        {
          vendor: 'Steuerberatung Schmidt & Partner',
          amount: { kind: 'money', amount: 297.5, currency: 'EUR' },
          dueDate: { kind: 'date', value: '2026-10-15' },
        },
        now,
      ).message,
    ).toBe('€297.50 to Steuerberatung Schmidt & Partner was due Oct 15');
  });

  it('has every changed key in every locale, with no ISO placeholders left', () => {
    for (const [locale, map] of Object.entries(NOTIFICATION_TRANSLATIONS)) {
      for (const key of [
        'subscription.upcoming',
        'subscription.upcoming.one',
        'tax.deadline.vat',
        'tax.deadline.vat.overdue',
        'tax.rates.official',
        'payable.overdue',
        'payable.due_soon',
      ] as const) {
        const entry = map[key];
        expect({ locale, key, ok: Boolean(entry?.title && entry?.message) }).toEqual({
          locale,
          key,
          ok: true,
        });
        expect(`${entry.title} ${entry.message}`).not.toMatch(
          /\{\{(periodStart|periodEnd|details|returnName)\}\}/,
        );
      }
    }
  });
});
