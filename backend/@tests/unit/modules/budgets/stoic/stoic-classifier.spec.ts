import { StoicClass } from '@/entities/category.entity';
import { suggestHelpsOthers, suggestStoicClass } from '@/modules/budgets/stoic/stoic-classifier';

describe('suggestStoicClass', () => {
  it.each([
    ['Rent', StoicClass.NECESSITY],
    ['Utilities', StoicClass.NECESSITY],
    ['Taxes', StoicClass.NECESSITY],
    ['Advertising', StoicClass.WORK],
    ['Office supplies', StoicClass.WORK],
    ['Meals and entertainment', StoicClass.LEISURE],
    ['Travel', StoicClass.LEISURE],
    ['Продукты', StoicClass.NECESSITY],
    ['Кафе и рестораны', StoicClass.LEISURE],
    ['Аптека', StoicClass.VIRTUE],
    ['Образование', StoicClass.VIRTUE],
    ['Благотворительность', StoicClass.VIRTUE],
  ])('suggests a class for %s', (name, expected) => {
    expect(suggestStoicClass(name)).toBe(expected);
  });

  it('matches stems at the start of a word only', () => {
    expect(suggestStoicClass('Crowbar')).toBeNull();
  });

  it('admits it does not know rather than guessing', () => {
    expect(suggestStoicClass('Other expenses')).toBeNull();
    expect(suggestStoicClass('')).toBeNull();
    expect(suggestStoicClass(null)).toBeNull();
  });

  it('recognises money given to others by name', () => {
    expect(suggestHelpsOthers('Charity')).toBe(true);
    expect(suggestHelpsOthers('Пожертвования')).toBe(true);
    expect(suggestHelpsOthers('Подарки родным')).toBe(true);
    expect(suggestHelpsOthers('Groceries')).toBe(false);
    expect(suggestHelpsOthers(null)).toBe(false);
  });
});
