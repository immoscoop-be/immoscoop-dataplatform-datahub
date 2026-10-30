/**
 * The plan of the Learning Cards, from the master learning plan (DEC-LR-02, DEC-LR-25): the Compass, the four
 * Learning Levels from easy to advanced, each in sections, and the Reading Cards. Every topic is a Learning Card,
 * written or still to be written; the written ones are files in \`cards/\` (DEC-LR-24). The titles are in English, as
 * the cards are written, with the Dutch of the master learning plan. Taken from Confluence on 2026-10-29.
 */

/** The languages of a card: English, as it is written, and Dutch (DEC-LR-24). */
export type Language = 'en' | 'nl';

/** A text in both languages: English, as written, and Dutch (DEC-LR-24). */
export type Text = Readonly<Record<Language, string>>;

/** Where a card stands: the Compass, a Learning Level, or the Reading Cards. */
export type LevelId = 'compass' | '1' | '2' | '3' | '4' | 'reading';

/** How much a card matters, shown only as "Suggested" (DEC-LR-18). */
export type Priority = 'required' | 'recommended' | 'inDepth';

/** What the reader can do afterwards: recognise, apply or judge. */
export type Thinking = 'recognise' | 'apply' | 'judge';

export interface Level {
  readonly id: LevelId;
  /** Its name, a name in the sense of the language principle: the same in both languages (NFR-LOC-01). */
  readonly name: string;
  /** How far along the way it is, from easy to advanced. */
  readonly step: Text;
  /** For whom it is. */
  readonly about: Text;
  /** The icon of its audience, from Phosphor (DEC-UX-62). */
  readonly icon: string;
}

export interface Section {
  readonly level: LevelId;
  readonly number: string;
  readonly title: Text;
}

export interface Topic {
  readonly number: string;
  readonly level: LevelId;
  readonly section: string;
  readonly title: Text;
  readonly priority: Priority | null;
  readonly thinking: Thinking | null;
  /** The cards it builds on, from the prior knowledge of the master learning plan. */
  readonly buildsOn: readonly string[];
}

export const LEVELS: readonly Level[] = [
  { id: 'compass', name: 'Compass', step: { en: 'Orientation', nl: 'Oriëntatie' }, about: { en: 'How data works at Immoscoop: the landscape, the tools, the agreements', nl: 'Hoe data bij Immoscoop werkt: het landschap, de tooling, de afspraken' }, icon: 'compass' },
  { id: '1', name: '1 · User', step: { en: 'Easy', nl: 'Makkelijk' }, about: { en: 'For everyone who opens a dashboard', nl: 'Voor iedereen die een dashboard opent' }, icon: 'user' },
  { id: '2', name: '2 · Data-aware user', step: { en: 'Intermediate', nl: 'Gemiddeld' }, about: { en: 'For whoever decides on figures', nl: 'Voor wie beslist op basis van cijfers' }, icon: 'user-focus' },
  { id: '3', name: '3 · Data analyst', step: { en: 'Advanced', nl: 'Gevorderd' }, about: { en: 'For whoever looks into data themselves', nl: 'Voor wie zelf in data kijkt' }, icon: 'chart-scatter' },
  { id: '4', name: '4 · Data owner and expert', step: { en: 'Expert', nl: 'Expert' }, about: { en: 'For whoever is responsible for data', nl: 'Voor wie verantwoordelijk is voor data' }, icon: 'user-gear' },
  { id: 'reading', name: 'Reading Cards', step: { en: 'Per chart', nl: 'Per grafiek' }, about: { en: 'How to read each standard chart, and the trap it avoids', nl: 'Hoe je elke standaardgrafiek leest, en welke valkuil ze vermijdt' }, icon: 'chart-line' },
];

export const SECTIONS: readonly Section[] = [
  { level: 'compass', number: 'K1', title: { en: 'The landscape', nl: 'Het landschap' } },
  { level: 'compass', number: 'K2', title: { en: 'Tooling', nl: 'Tooling' } },
  { level: 'compass', number: 'K3', title: { en: 'Governance', nl: 'Governance' } },
  { level: 'compass', number: 'K4', title: { en: 'Processes', nl: 'Processen' } },
  { level: 'compass', number: 'K5', title: { en: 'Data Hub', nl: 'Data Hub' } },
  { level: '1', number: '1.1', title: { en: 'Orientation', nl: 'Oriëntatie' } },
  { level: '1', number: '1.2', title: { en: 'Definition awareness', nl: 'Definitiebewustzijn' } },
  { level: '1', number: '1.3', title: { en: 'Reading charts: scale and axes', nl: 'Grafieken lezen: schaal en assen' } },
  { level: '1', number: '1.4', title: { en: 'Reading charts: time', nl: 'Grafieken lezen: tijd' } },
  { level: '1', number: '1.5', title: { en: 'Reading charts: summarising', nl: 'Grafieken lezen: samenvatten' } },
  { level: '1', number: '1.6', title: { en: 'Reading charts: categories', nl: 'Grafieken lezen: categorieën' } },
  { level: '1', number: '1.7', title: { en: 'Reading charts: change', nl: 'Grafieken lezen: verandering' } },
  { level: '1', number: '1.8', title: { en: 'Reading charts: what is missing', nl: 'Grafieken lezen: wat er ontbreekt' } },
  { level: '1', number: '1.9', title: { en: 'Daring to voice doubt', nl: 'Twijfel durven uiten' } },
  { level: '2', number: '2.1', title: { en: 'Metric literacy', nl: 'Metric literacy' } },
  { level: '2', number: '2.2', title: { en: 'Noise, signal and cause', nl: 'Ruis, signaal en oorzaak' } },
  { level: '2', number: '2.3', title: { en: 'Scoping the question', nl: 'Vraag afbakenen' } },
  { level: '3', number: '3.1', title: { en: 'Domain model literacy (using)', nl: 'Domain model literacy (gebruiken)' } },
  { level: '3', number: '3.2', title: { en: 'EDA: the basics', nl: 'EDA — basis' } },
  { level: '3', number: '3.3', title: { en: 'Data quality: understanding', nl: 'Data quality — begrip' } },
  { level: '3', number: '3.4', title: { en: 'Uncertainty', nl: 'Onzekerheid' } },
  { level: '3', number: '3.5', title: { en: 'Pitfalls of analysis', nl: 'Analyse-valkuilen' } },
  { level: '3', number: '3.6', title: { en: 'Experiments and A/B tests', nl: 'Experimenten en A/B-testen' } },
  { level: '4', number: '4.1', title: { en: 'Domain model literacy (contributing)', nl: 'Domain model literacy (bijdragen)' } },
  { level: '4', number: '4.2', title: { en: 'EDA: growing', nl: 'EDA — groei' } },
  { level: '4', number: '4.3', title: { en: 'Governance awareness', nl: 'Governance awareness' } },
  { level: '4', number: '4.4', title: { en: 'Judging access', nl: 'Access-oordeel' } },
  { level: '4', number: '4.5', title: { en: 'Impact awareness', nl: 'Impact awareness' } },
  { level: '4', number: '4.6', title: { en: 'Communicating and translating', nl: 'Communicatie- en vertaalvermogen' } },
  { level: '4', number: '4.7', title: { en: 'Roles', nl: 'Rollen' } },
  { level: 'reading', number: 'R', title: { en: 'Reading Cards per standard chart', nl: 'Leeskaarten per standaardgrafiek' } },
];

export const TOPICS: readonly Topic[] = [
  { number: 'K1.1', level: 'compass', section: 'K1', title: { en: 'From source to chart', nl: 'Van bron tot grafiek' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K1.2', level: 'compass', section: 'K1', title: { en: 'Where data is born', nl: 'Waar data ontstaat' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K2.1', level: 'compass', section: 'K2', title: { en: 'The domain model and Colleciónes', nl: 'Het domeinmodel en Colleciónes' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K2.2', level: 'compass', section: 'K2', title: { en: 'Domain Hub', nl: 'Domain Hub' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K2.3', level: 'compass', section: 'K2', title: { en: 'BigQuery', nl: 'BigQuery' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K2.4', level: 'compass', section: 'K2', title: { en: 'dbt', nl: 'dbt' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K2.5', level: 'compass', section: 'K2', title: { en: 'Ratchet', nl: 'Ratchet' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K2.6', level: 'compass', section: 'K2', title: { en: 'Dashboards and the chart language', nl: 'Dashboards en de grafiektaal' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K3.1', level: 'compass', section: 'K3', title: { en: 'Who is the source of truth for what', nl: 'Wie is waar de bron van waarheid' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K3.2', level: 'compass', section: 'K3', title: { en: 'Ownership at Immoscoop', nl: 'Ownership bij Immoscoop' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K3.3', level: 'compass', section: 'K3', title: { en: 'The EDA gate', nl: 'De EDA-gate' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K3.4', level: 'compass', section: 'K3', title: { en: 'Where definitions live', nl: 'Waar definities leven' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K3.5', level: 'compass', section: 'K3', title: { en: 'Sharing by the access ladder', nl: 'Delen volgens de access-ladder' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K4.1', level: 'compass', section: 'K4', title: { en: 'Asking data a question', nl: 'Een vraag stellen aan data' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K4.2', level: 'compass', section: 'K4', title: { en: 'Having something new measured', nl: 'Iets nieuws laten meten' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K4.3', level: 'compass', section: 'K4', title: { en: 'Sharing a figure or a dataset', nl: 'Een cijfer of dataset delen' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K4.4', level: 'compass', section: 'K4', title: { en: 'Reporting an error or a doubt', nl: 'Een fout of twijfel melden' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'K5.1', level: 'compass', section: 'K5', title: { en: 'What a resource is', nl: 'Wat een resource is' }, priority: null, thinking: null, buildsOn: [] },
  // Added to the master learning plan by Data Hub, which explains its Levels nowhere else (DEC-LR-30).
  { number: 'K5.2', level: 'compass', section: 'K5', title: { en: 'The Level of a Resource', nl: 'Het Level van een Resource' }, priority: null, thinking: null, buildsOn: ['K5.1'] },
  { number: '1.1.1', level: '1', section: '1.1', title: { en: 'The three questions', nl: 'De drie vragen' }, priority: 'required', thinking: 'apply', buildsOn: [] },
  { number: '1.2.1', level: '1', section: '1.2', title: { en: 'What a figure counts exactly', nl: 'Wat een cijfer precies telt' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.1.1'] },
  { number: '1.2.2', level: '1', section: '1.2', title: { en: 'Unique counts don\'t add up', nl: 'Unieke tellingen tel je niet op' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.1'] },
  { number: '1.2.3', level: '1', section: '1.2', title: { en: 'Count versus ratio', nl: 'Aantal versus ratio' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.1'] },
  { number: '1.2.4', level: '1', section: '1.2', title: { en: 'Which date counts', nl: 'Welke datum telt' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.2.1'] },
  { number: '1.2.5', level: '1', section: '1.2', title: { en: 'Measurement loss from cookie consent', nl: 'Meetverlies door cookie-consent' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.2.1'] },
  { number: '1.2.6', level: '1', section: '1.2', title: { en: 'Claiming the right term', nl: 'De juiste term opeisen' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.1'] },
  { number: '1.2.7', level: '1', section: '1.2', title: { en: 'State or movement', nl: 'Stand of beweging' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.2.1'] },
  { number: '1.3.1', level: '1', section: '1.3', title: { en: 'Axis scale', nl: 'As-schaal' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.1.1'] },
  { number: '1.3.2', level: '1', section: '1.3', title: { en: 'Dual axes', nl: 'Dubbele assen' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.3.1'] },
  { number: '1.3.3', level: '1', section: '1.3', title: { en: 'Inconsistent scale in a comparison', nl: 'Inconsistente schaal bij vergelijking' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.3.1'] },
  { number: '1.3.4', level: '1', section: '1.3', title: { en: 'Aspect ratio', nl: 'Beeldverhouding' }, priority: 'inDepth', thinking: 'recognise', buildsOn: ['1.3.1'] },
  { number: '1.3.5', level: '1', section: '1.3', title: { en: 'Logarithmic scale', nl: 'Logaritmische schaal' }, priority: 'inDepth', thinking: 'recognise', buildsOn: ['1.3.1'] },
  { number: '1.3.6', level: '1', section: '1.3', title: { en: 'Reading the legend', nl: 'De legende lezen' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.1.1'] },
  { number: '1.4.1', level: '1', section: '1.4', title: { en: 'Time window awareness', nl: 'Tijdvenster-bewustzijn' }, priority: 'required', thinking: 'apply', buildsOn: ['1.1.1'] },
  { number: '1.4.2', level: '1', section: '1.4', title: { en: 'Rolling period versus calendar period', nl: 'Rollende periode versus kalenderperiode' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.4.1'] },
  { number: '1.4.3', level: '1', section: '1.4', title: { en: 'Moving average', nl: 'Voortschrijdend gemiddelde' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.4.2'] },
  { number: '1.4.4', level: '1', section: '1.4', title: { en: 'Cumulative versus non-cumulative', nl: 'Cumulatief versus niet-cumulatief' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.4.1'] },
  { number: '1.4.5', level: '1', section: '1.4', title: { en: 'Trend lines', nl: 'Trendlijnen' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.4.1'] },
  { number: '1.4.6', level: '1', section: '1.4', title: { en: 'Seasonal effects', nl: 'Seizoenseffecten' }, priority: 'required', thinking: 'apply', buildsOn: ['1.4.2'] },
  { number: '1.5.1', level: '1', section: '1.5', title: { en: 'Aggregation', nl: 'Aggregatie' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.1.1'] },
  { number: '1.5.2', level: '1', section: '1.5', title: { en: 'The average of averages', nl: 'Gemiddelde van gemiddelden' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.3', '1.5.1'] },
  { number: '1.5.3', level: '1', section: '1.5', title: { en: 'Bar or dot: amount or position', nl: 'Staaf of punt: hoeveelheid of positie' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.3.1'] },
  { number: '1.5.4', level: '1', section: '1.5', title: { en: 'Centre and spread belong together', nl: 'Midden en spreiding horen samen' }, priority: 'required', thinking: 'recognise', buildsOn: ['1.5.1'] },
  { number: '1.6.1', level: '1', section: '1.6', title: { en: 'Complete and mutually exclusive (MECE)', nl: 'Volledig en elkaar uitsluitend (MECE)' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.1'] },
  { number: '1.6.2', level: '1', section: '1.6', title: { en: 'Nominal and ordinal', nl: 'Nominaal en ordinaal' }, priority: 'inDepth', thinking: 'recognise', buildsOn: ['1.6.1'] },
  { number: '1.6.3', level: '1', section: '1.6', title: { en: 'Stacked charts', nl: 'Gestapelde grafieken' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.6.1'] },
  { number: '1.6.4', level: '1', section: '1.6', title: { en: 'Pie charts and 3D effects', nl: 'Taartdiagrammen en 3D-effecten' }, priority: 'inDepth', thinking: 'recognise', buildsOn: ['1.6.1'] },
  { number: '1.7.1', level: '1', section: '1.7', title: { en: 'Percentages on small numbers', nl: 'Percentages bij kleine aantallen' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.3'] },
  { number: '1.7.2', level: '1', section: '1.7', title: { en: 'Percent versus percentage point', nl: 'Procent versus procentpunt' }, priority: 'required', thinking: 'apply', buildsOn: ['1.7.1'] },
  { number: '1.7.3', level: '1', section: '1.7', title: { en: 'Growth and decline: percentages and index', nl: 'Groei en krimp: procenten en index' }, priority: 'recommended', thinking: 'apply', buildsOn: ['1.7.1'] },
  { number: '1.8.1', level: '1', section: '1.8', title: { en: 'Missing data and broken lines', nl: 'Ontbrekende data en onderbroken lijnen' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['1.1.1'] },
  { number: '1.8.2', level: '1', section: '1.8', title: { en: 'What the chart leaves out', nl: 'Wat de grafiek weglaat' }, priority: 'recommended', thinking: 'judge', buildsOn: ['1.4.1'] },
  { number: '1.9.1', level: '1', section: '1.9', title: { en: 'Questioning a figure', nl: 'Een cijfer in twijfel trekken' }, priority: 'required', thinking: 'apply', buildsOn: ['1.1.1'] },
  { number: '2.1.1', level: '2', section: '2.1', title: { en: 'What a metric does and does not tell', nl: 'Wat een metriek wel en niet vertelt' }, priority: 'required', thinking: 'judge', buildsOn: ['1.2.1'] },
  { number: '2.1.2', level: '2', section: '2.1', title: { en: 'Measurement validity', nl: 'Meetvaliditeit' }, priority: 'required', thinking: 'judge', buildsOn: ['2.1.1'] },
  { number: '2.1.3', level: '2', section: '2.1', title: { en: 'Leading versus lagging indicators', nl: 'Voorlopende versus achterlopende indicatoren' }, priority: 'recommended', thinking: 'apply', buildsOn: ['2.1.1'] },
  { number: '2.1.4', level: '2', section: '2.1', title: { en: 'When a measure becomes a target', nl: 'Wanneer een maat een doel wordt' }, priority: 'required', thinking: 'judge', buildsOn: ['2.1.1'] },
  { number: '2.1.5', level: '2', section: '2.1', title: { en: 'Vanity metrics versus steering metrics', nl: 'IJdelheidsmetrieken versus stuurmetrieken' }, priority: 'required', thinking: 'judge', buildsOn: ['2.1.1'] },
  { number: '2.1.6', level: '2', section: '2.1', title: { en: 'Cohort funnel versus period funnel', nl: 'Cohortfunnel versus periodefunnel' }, priority: 'required', thinking: 'judge', buildsOn: ['1.2.2', '1.2.4'] },
  { number: '2.1.7', level: '2', section: '2.1', title: { en: 'Attribution of lead sources', nl: 'Attributie van leadbronnen' }, priority: 'required', thinking: 'judge', buildsOn: ['1.6.1'] },
  { number: '2.2.1', level: '2', section: '2.2', title: { en: 'Noise versus signal', nl: 'Ruis versus signaal' }, priority: 'required', thinking: 'judge', buildsOn: ['1.4.1', '1.7.1'] },
  { number: '2.2.2', level: '2', section: '2.2', title: { en: 'Moving together is no cause', nl: 'Samen bewegen is geen oorzaak' }, priority: 'required', thinking: 'judge', buildsOn: ['2.2.1'] },
  { number: '2.3.1', level: '2', section: '2.3', title: { en: 'From a vague to a scoped question', nl: 'Van vage naar afgebakende vraag' }, priority: 'required', thinking: 'apply', buildsOn: ['1.1.1'] },
  { number: '2.3.2', level: '2', section: '2.3', title: { en: 'Dealing with the ping-pong ball position', nl: 'Omgaan met de pingpongbal-positie' }, priority: 'required', thinking: 'apply', buildsOn: ['2.3.1'] },
  { number: '2.3.3', level: '2', section: '2.3', title: { en: 'Choosing the basis of comparison', nl: 'De vergelijkingsbasis kiezen' }, priority: 'required', thinking: 'judge', buildsOn: ['1.1.1', '1.4.6'] },
  { number: '2.3.4', level: '2', section: '2.3', title: { en: 'Saying beforehand what you will do with the answer', nl: 'Vooraf zeggen wat je met het antwoord doet' }, priority: 'required', thinking: 'apply', buildsOn: ['2.3.1'] },
  { number: '2.3.5', level: '2', section: '2.3', title: { en: 'The grain question: what is one row, and along which key do you count?', nl: 'De grain-vraag: wat is één rij, en langs welke sleutel tel je?' }, priority: 'required', thinking: 'apply', buildsOn: ['2.3.1', '1.2.2'] },
  // Not in the master learning plan: the card on the model types, next to the grain question (FR-LR-39).
  { number: '2.3.6', level: '2', section: '2.3', title: { en: 'Five model types, and what each means for counting', nl: 'Vijf modeltypes, en wat elk betekent voor tellen' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['2.3.5'] },
  { number: '3.1.1', level: '3', section: '3.1', title: { en: 'Entities and relations', nl: 'Entiteiten en relaties' }, priority: 'required', thinking: 'apply', buildsOn: ['2.3.1'] },
  { number: '3.1.2', level: '3', section: '3.1', title: { en: 'A shared language', nl: 'Gedeelde taal' }, priority: 'required', thinking: 'apply', buildsOn: ['3.1.1'] },
  { number: '3.1.3', level: '3', section: '3.1', title: { en: 'Grain: one row is one what', nl: 'Grain: één rij is één wat' }, priority: 'required', thinking: 'apply', buildsOn: ['3.1.1'] },
  { number: '3.1.4', level: '3', section: '3.1', title: { en: 'States and history', nl: 'Toestanden en historiek' }, priority: 'recommended', thinking: 'apply', buildsOn: ['3.1.3'] },
  { number: '3.1.5', level: '3', section: '3.1', title: { en: 'State and event data', nl: 'State en event data' }, priority: 'required', thinking: 'apply', buildsOn: ['3.1.1', '3.1.3'] },
  { number: '3.2.1', level: '3', section: '3.2', title: { en: 'Mean, median, mode', nl: 'Gemiddelde, mediaan, modus' }, priority: 'required', thinking: 'apply', buildsOn: ['1.5.4'] },
  { number: '3.2.2', level: '3', section: '3.2', title: { en: 'Percentiles and quartiles', nl: 'Percentielen en kwartielen' }, priority: 'recommended', thinking: 'apply', buildsOn: ['3.2.1'] },
  { number: '3.2.3', level: '3', section: '3.2', title: { en: 'Standard deviation', nl: 'Standaarddeviatie' }, priority: 'recommended', thinking: 'apply', buildsOn: ['3.2.1'] },
  { number: '3.2.4', level: '3', section: '3.2', title: { en: 'Cardinality', nl: 'Cardinaliteit' }, priority: 'required', thinking: 'apply', buildsOn: ['3.1.1', '3.1.3'] },
  { number: '3.2.5', level: '3', section: '3.2', title: { en: 'Empty, zero and unknown', nl: 'Leeg, nul en onbekend' }, priority: 'required', thinking: 'apply', buildsOn: ['3.1.3'] },
  { number: '3.2.6', level: '3', section: '3.2', title: { en: 'Outliers', nl: 'Uitschieters' }, priority: 'recommended', thinking: 'judge', buildsOn: ['3.2.2'] },
  { number: '3.2.7', level: '3', section: '3.2', title: { en: 'Looking at the distribution', nl: 'De verdeling bekijken' }, priority: 'recommended', thinking: 'apply', buildsOn: ['3.2.1'] },
  { number: '3.3.1', level: '3', section: '3.3', title: { en: 'Aspects of quality', nl: 'Kwaliteitsaspecten' }, priority: 'required', thinking: 'judge', buildsOn: ['3.2.5'] },
  { number: '3.3.2', level: '3', section: '3.3', title: { en: 'Validations and blind spots', nl: 'Validaties en blinde vlekken' }, priority: 'required', thinking: 'judge', buildsOn: ['3.3.1'] },
  { number: '3.3.3', level: '3', section: '3.3', title: { en: 'Reliable for which purpose', nl: 'Betrouwbaar voor welk doel' }, priority: 'recommended', thinking: 'judge', buildsOn: ['3.3.1'] },
  { number: '3.4.1', level: '3', section: '3.4', title: { en: 'Reading uncertainty intervals', nl: 'Onzekerheidsintervallen lezen' }, priority: 'recommended', thinking: 'apply', buildsOn: ['2.2.1', '3.2.3'] },
  { number: '3.5.1', level: '3', section: '3.5', title: { en: 'Simpson\'s paradox', nl: 'Simpson\'s paradox' }, priority: 'recommended', thinking: 'judge', buildsOn: ['1.5.2'] },
  { number: '3.5.2', level: '3', section: '3.5', title: { en: 'Survivorship bias', nl: 'Survivorship bias' }, priority: 'recommended', thinking: 'judge', buildsOn: ['3.1.4'] },
  { number: '3.5.3', level: '3', section: '3.5', title: { en: 'Closed and running cases', nl: 'Afgesloten en lopende gevallen' }, priority: 'required', thinking: 'apply', buildsOn: ['3.5.2', '2.1.6'] },
  { number: '3.6.1', level: '3', section: '3.6', title: { en: 'Control group and random assignment', nl: 'Controlegroep en willekeurige toewijzing' }, priority: 'required', thinking: 'apply', buildsOn: ['2.2.2'] },
  { number: '3.6.2', level: '3', section: '3.6', title: { en: 'A hypothesis and a stopping point beforehand', nl: 'Vooraf een hypothese en een stopmoment' }, priority: 'required', thinking: 'apply', buildsOn: ['3.6.1', '2.3.4'] },
  { number: '3.6.3', level: '3', section: '3.6', title: { en: 'Many tests at once', nl: 'Veel testen tegelijk' }, priority: 'recommended', thinking: 'judge', buildsOn: ['3.6.2'] },
  { number: '4.1.1', level: '4', section: '4.1', title: { en: 'Consistency and specificity', nl: 'Consistentie en specificiteit' }, priority: 'required', thinking: 'judge', buildsOn: ['3.1.2'] },
  { number: '4.1.2', level: '4', section: '4.1', title: { en: 'Recording definitions in one place', nl: 'Definities vastleggen op één plek' }, priority: 'required', thinking: 'apply', buildsOn: ['4.1.1'] },
  { number: '4.2.1', level: '4', section: '4.2', title: { en: 'Correlation versus causation', nl: 'Correlatie versus causaliteit' }, priority: 'required', thinking: 'judge', buildsOn: ['2.2.2', '3.6.1'] },
  { number: '4.2.2', level: '4', section: '4.2', title: { en: 'Shape of a distribution and detecting outliers', nl: 'Distributievorm en outlier-detectie' }, priority: 'recommended', thinking: 'apply', buildsOn: ['3.2.6', '3.2.3'] },
  { number: '4.2.3', level: '4', section: '4.2', title: { en: 'Sample size', nl: 'Steekproefgrootte' }, priority: 'required', thinking: 'judge', buildsOn: ['3.4.1', '3.6.2'] },
  { number: '4.2.4', level: '4', section: '4.2', title: { en: 'Selection bias', nl: 'Selectiebias' }, priority: 'recommended', thinking: 'judge', buildsOn: ['3.5.2'] },
  { number: '4.2.5', level: '4', section: '4.2', title: { en: 'Regression to the mean', nl: 'Regressie naar het gemiddelde' }, priority: 'inDepth', thinking: 'judge', buildsOn: ['2.2.1'] },
  { number: '4.3.1', level: '4', section: '4.3', title: { en: 'Changing a definition, keeping trust', nl: 'Wijzigende definities zonder vertrouwen te breken' }, priority: 'required', thinking: 'apply', buildsOn: ['4.1.2'] },
  { number: '4.3.2', level: '4', section: '4.3', title: { en: 'Versions and agreements with users', nl: 'Versies en afspraken met gebruikers' }, priority: 'required', thinking: 'judge', buildsOn: ['4.3.1'] },
  { number: '4.3.3', level: '4', section: '4.3', title: { en: 'Announcing and phasing out', nl: 'Aankondigen en uitfaseren' }, priority: 'recommended', thinking: 'apply', buildsOn: ['4.3.2'] },
  { number: '4.3.4', level: '4', section: '4.3', title: { en: 'Marking a break in the series', nl: 'Een breuk in de reeks markeren' }, priority: 'recommended', thinking: 'apply', buildsOn: ['4.3.1'] },
  { number: '4.4.1', level: '4', section: '4.4', title: { en: 'The maturity ladder', nl: 'De maturiteitsladder' }, priority: 'required', thinking: 'judge', buildsOn: ['3.3.3'] },
  { number: '4.4.2', level: '4', section: '4.4', title: { en: 'Sensitivity and personal data', nl: 'Gevoeligheid en persoonsgegevens' }, priority: 'required', thinking: 'judge', buildsOn: ['4.4.1'] },
  { number: '4.5.1', level: '4', section: '4.5', title: { en: 'Who consumes outside your domain', nl: 'Weten wie buiten je domein consumeert' }, priority: 'required', thinking: 'judge', buildsOn: ['4.3.2'] },
  { number: '4.6.1', level: '4', section: '4.6', title: { en: 'Translating across the gap with the user', nl: 'Vertalen naar de kloof met de gebruiker' }, priority: 'required', thinking: 'apply', buildsOn: ['1.2.6'] },
  { number: '4.6.2', level: '4', section: '4.6', title: { en: 'Communicating uncertainty', nl: 'Onzekerheid communiceren' }, priority: 'required', thinking: 'apply', buildsOn: ['3.4.1'] },
  { number: '4.7.1', level: '4', section: '4.7', title: { en: 'Owner and steward', nl: 'Owner en steward' }, priority: 'recommended', thinking: 'recognise', buildsOn: ['4.4.1'] },
  { number: 'R1', level: 'reading', section: 'R', title: { en: 'Time series', nl: 'Time series' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R2', level: 'reading', section: 'R', title: { en: 'Cumulative', nl: 'Cumulative' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R3', level: 'reading', section: 'R', title: { en: 'KPI status', nl: 'KPI status' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R4', level: 'reading', section: 'R', title: { en: 'KPI tile', nl: 'KPI tile' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R5', level: 'reading', section: 'R', title: { en: 'Bar chart', nl: 'Bar chart' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R6', level: 'reading', section: 'R', title: { en: 'Comparison with last year', nl: 'Comparison with last year' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R7', level: 'reading', section: 'R', title: { en: 'Distribution', nl: 'Distribution' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R8', level: 'reading', section: 'R', title: { en: 'Ratio', nl: 'Ratio' }, priority: null, thinking: null, buildsOn: [] },
  { number: 'R9', level: 'reading', section: 'R', title: { en: 'Cohort', nl: 'Cohort' }, priority: null, thinking: null, buildsOn: [] },
];

const BY_NUMBER = new Map(TOPICS.map((topic) => [topic.number, topic]));

/** A topic by its number, or undefined for a number the plan does not have. */
export function topicOf(number: string): Topic | undefined {
  return BY_NUMBER.get(number);
}
