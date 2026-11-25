import type { MarkerPlace } from './markers.js';
import type { Language } from './plan.js';

/**
 * The terms of the dictionary that a screen explains (DEC-UX-279, FR-LR-44, TR-LR-10): each with its name as
 * docs/definitions.md writes it, and per language the name a screen shows and its definition, in one or two
 * sentences for the User. Its key is its place in `MARKERS`, which lists the Learning Cards that explain it. The web
 * app shows the definition first in the pop-out of the marker of the term; Claude unfolds it under the title of a
 * step of the Owner Journey.
 */
export interface Term {
  /** The Defined Term in docs/definitions.md, which a test holds it to. */
  term: string;
  text: Record<Language, { name: string; definition: string }>;
}

export const TERMS = {
  businessDescription: {
    term: 'Business Description',
    text: {
      en: {
        name: 'Business Description',
        definition:
          'The description of a Resource or of one of its fields in the words of the business: what it represents and what it is used for, written by its Owner or the Data Team. It stands next to the description from dbt, which says how the data is made, and never replaces it.',
      },
      nl: {
        name: 'Business Description',
        definition:
          'De beschrijving van een Resource of van een van zijn velden in de woorden van de business: wat het voorstelt en waarvoor het dient, geschreven door de Owner of het Data Team. Ze staat naast de beschrijving uit dbt, die zegt hoe de data gemaakt wordt, en vervangt die nooit.',
      },
    },
  },
  grain: {
    term: 'Grain',
    text: {
      en: {
        name: 'Grain',
        definition:
          'What one row of a Resource is: the fields that together identify each row, with one sentence, such as "one row per listing per day". No two rows have the same values in them. Not a Key Field, which is where a colleague starts.',
      },
      nl: {
        name: 'Grain',
        definition:
          'Wat één rij van een Resource is: de velden die samen elke rij aanduiden, met één zin, zoals "één rij per pand per dag". Geen twee rijen hebben dezelfde waarden erin. Geen Key Field: dat is waar een collega begint.',
      },
    },
  },
  dbt: {
    term: 'dbt',
    text: {
      en: {
        name: 'dbt',
        definition:
          'The tool in which the Data Team builds the tables of BigQuery from SQL models, in dbt projects. Data Hub follows those projects; the description from dbt is what its dbt project says of a table or a field.',
      },
      nl: {
        name: 'dbt',
        definition:
          'De tool waarin het Data Team de tabellen van BigQuery bouwt uit SQL-modellen, in dbt-projecten. Data Hub volgt die projecten; de beschrijving uit dbt is wat zijn dbt-project over een tabel of een veld zegt.',
      },
    },
  },
  keyField: {
    term: 'Key Field',
    text: {
      en: {
        name: 'Key Field',
        definition:
          'A field of a Resource that matters most, marked on its Resource Card by its Owner or the Data Team: where a colleague starts, and what the EDA explores at least. Not the key of the table, and not the Grain, which says what makes a row unique. Its Business Description is required before the Resource is published.',
      },
      nl: {
        name: 'Key Field',
        definition:
          'Een veld van een Resource dat het meest telt, aangeduid op de Resource Card door de Owner of het Data Team: waar een collega begint, en wat de EDA minstens onderzoekt. Niet de sleutel van de tabel, en niet de Grain, die zegt wat een rij uniek maakt. Zijn Business Description is verplicht voor de Resource gepubliceerd wordt.',
      },
    },
  },
  knownGap: {
    term: 'Known Gap',
    text: {
      en: {
        name: 'Known Gap',
        definition:
          'A gap in the data itself: a period, a field or rows that are missing or only partly there. It would go away if the data were repaired. What stays true even when every row is right is a Pitfall.',
      },
      nl: {
        name: 'Known Gap',
        definition:
          'Een gat in de data zelf: een periode, een veld of rijen die ontbreken of maar gedeeltelijk aanwezig zijn. Het zou verdwijnen als de data hersteld werd. Wat waar blijft, ook als elke rij klopt, is een Pitfall.',
      },
    },
  },
  reliableSince: {
    term: 'Reliable Since',
    text: {
      en: {
        name: 'Reliable Since',
        definition:
          'The day from which the whole table of a Resource can be relied on, read on its Date Field, with why not earlier; or from its first row. Rows before it stay, but are not to be read as reliable: a trend or a comparison starts there. A hole after that day, or in part of the rows, is a Known Gap.',
      },
      nl: {
        name: 'Reliable Since',
        definition:
          'De dag vanaf wanneer de hele tabel van een Resource betrouwbaar is, gelezen op zijn Date Field, met waarom niet eerder; of vanaf zijn eerste rij. Rijen ervoor blijven, maar lees ze niet als betrouwbaar: een trend of een vergelijking begint daar. Een gat na die dag, of in een deel van de rijen, is een Known Gap.',
      },
    },
  },
  dateField: {
    term: 'Date Field',
    text: {
      en: {
        name: 'Date Field',
        definition:
          'The one date field of a Resource that Reliable Since is read on. Its table type gives it: the event date of an event, the date of a fact, the period of an aggregate, the created or updated date of a state.',
      },
      nl: {
        name: 'Date Field',
        definition:
          'Het ene datumveld van een Resource waarop Reliable Since gelezen wordt. Zijn tabeltype geeft het: de datum van een event, de datum van een fact, de periode van een aggregate, de aanmaak- of wijzigingsdatum van een state.',
      },
    },
  },
  pitfall: {
    term: 'Pitfall',
    text: {
      en: {
        name: 'Pitfall',
        definition:
          'A way to read a Resource wrongly that looks right: what a field means, what a figure counts or when it is final. It is about how the data is read, not the data itself: it stays true even when every row is right. A gap in the data is a Known Gap.',
      },
      nl: {
        name: 'Pitfall',
        definition:
          'Een manier om een Resource verkeerd te lezen die juist lijkt: wat een veld betekent, wat een cijfer telt of wanneer het definitief is. Het gaat over hoe de data gelezen wordt, niet over de data zelf: het blijft waar, ook als elke rij klopt. Een gat in de data is een Known Gap.',
      },
    },
  },
  knownBehaviour: {
    term: 'Known Behaviour',
    text: {
      en: {
        name: 'Known Behaviour',
        definition: 'The part of the Resource Card that says how the data behaves in use: what it is meant for, its pitfalls, its Known Gaps and from when it can be trusted.',
      },
      nl: {
        name: 'Known Behaviour',
        definition: 'Het deel van de Resource Card dat zegt hoe de data zich gedraagt in gebruik: waarvoor ze bedoeld is, haar Pitfalls, haar Known Gaps en vanaf wanneer ze betrouwbaar is.',
      },
    },
  },
} as const satisfies Partial<Record<MarkerPlace, Term>>;

export type TermKey = keyof typeof TERMS;

/** The term a place explains, when the place is one (DEC-UX-279); a marker of system text otherwise. */
export const termOf = (place: string): Term | null => (Object.hasOwn(TERMS, place) ? TERMS[place as TermKey] : null);
