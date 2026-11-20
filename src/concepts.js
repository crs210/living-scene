// The scene's vocabulary. Each concept owns one distinct treatment in the picture.
// pol  = the polarity the treatment naturally expresses (-1 fear, +1 hope).
// kw   = fast, high-precision lexicon tier.
// seeds = natural-language paraphrases for the open-vocabulary embedding tier.

export const CONCEPTS = [
  { id: 'dread', pol: -1, treatment: 'a shadowy presence leans in from the left edge',
    kw: /\b(dread\w*|doom\w*|existential\w*|extinct\w*|apocalyp\w*|end of (the )?(world|humanity)|the unknown|wipe[sd]? (us |humanity )?out|ominous|skynet|terminator)\b/i,
    seeds: ['a vague sense of dread about the future', 'it could be the end of humanity', 'I just have a bad feeling about all of it', 'nobody knows where this is heading and that frightens me'] },
  { id: 'security', pol: -1, treatment: 'locks fail and doors along the street slide open',
    kw: /\b(hack\w*|cyber\w*|breach\w*|password\w*|phish\w*|scam\w*|fraud\w*|malware|ransomware|leak\w*|identity theft|locks?|secur\w*|vulnerab\w*|attack\w*|break\w* in(to)?|bank accounts?)\b/i,
    seeds: ['criminals breaking into computer systems', 'my accounts and passwords being stolen', 'scammers tricking people out of their savings', 'our digital defences will not hold'] },
  { id: 'understanding', pol: 1, treatment: 'two streams of light travel the river and braid together',
    kw: /\b(understand\w*|translat\w*|communicat\w*|empath\w*|language barriers?|bring\w* (people|us|everyone) together|listen\w*|common ground|each other|one another|dialogue|bridg\w*|less divided|across cultures)\b/i,
    seeds: ['helping people understand each other', 'translating between languages and cultures', 'people who disagree finally finding common ground', 'feeling less alone and more connected to others'] },
  { id: 'jobs', pol: -1, treatment: 'walkers on the quay become automatons while people sit idle',
    kw: /\b(jobs?|work(ers?|force|place)?|unemploy\w*|employ\w*|careers?|livelihoods?|laid off|layoffs?|redundan\w*|replac\w*|automat\w*|wages?|income|make a living|profession\w*|my role)\b/i,
    seeds: ['people losing their jobs to machines', 'my career might not exist in ten years', 'there will be nothing left for humans to do for a living', 'whole professions made redundant'] },
  { id: 'surveillance', pol: -1, treatment: 'street lamps become eyes whose beams follow people',
    kw: /\b(surveil\w*|privacy|private|watch(ed|ing)|track(ed|ing)|spy\w*|monitor\w*|big brother|facial recognition|cameras?|my data|our data|personal data|profil(e|ed|ing))\b/i,
    seeds: ['being watched all the time', 'companies and governments tracking everything I do', 'no more privacy anywhere', 'everything about me being recorded and analysed'] },
  { id: 'misinfo', pol: -1, treatment: 'counterfeit moons multiply in the sky',
    kw: /\b(misinformation|disinformation|deep ?fakes?|fake\w*|propaganda|lies|lying|truth|whats real|what is real|manipulat\w*|hallucinat\w*|bots?|slop|trust (what|anything)|believe (what|anything)|real anymore)\b/i,
    seeds: ['not being able to tell what is real anymore', 'fake videos and made-up news everywhere', 'people being manipulated by convincing lies', 'my grandchildren will not know what is true'] },
  { id: 'growth', pol: 1, treatment: 'the tree on the hill grows and blossoms',
    kw: /\b(cur(e|es|ed|ing)|medic\w*|health\w*|diseases?|cancer|doctors?|diagnos\w*|drugs?|therap\w*|longevity|hospitals?|patients?|treatments?|alzheimer\w*|illness\w*|disabilit\w*|accessib\w*)\b/i,
    seeds: ['curing diseases that kill people today', 'better medicine and earlier diagnosis', 'people living longer healthier lives', 'help for people who are ill or disabled'] },
  { id: 'discovery', pol: 1, treatment: 'stars link up into constellations',
    kw: /\b(discover\w*|scien\w*|research\w*|learn\w*|educat\w*|teach\w*|tutor\w*|knowledge|students?|schools?|space|physics|math\w*|explor\w*|univers\w*|kids learn\w*)\b/i,
    seeds: ['new scientific discoveries', 'every child having a patient personal tutor', 'understanding the universe faster than ever', 'learning anything I am curious about'] },
  { id: 'control', pol: -1, treatment: 'the signal tower grows and strings cables to every roof',
    kw: /\b(control\w*|superintelligen\w*|agi|take ?over|takes over|power(ful)?|monopol\w*|billionaires?|corporations?|big tech|concentrat\w*|dependen\w*|reliant|reliance|rely on (it|ai|them)|autonom\w*|align\w*|rogue|obey|overlords?|who decides|a few companies|think for ourselves|smarter than us)\b/i,
    seeds: ['a handful of companies holding all the power', 'machines making decisions we cannot overrule', 'humans no longer being in charge', 'we will depend on it for everything and forget how to think'] },
  { id: 'creativity', pol: 1, treatment: 'paper lanterns rise from the rooftops',
    kw: /\b(creativ\w*|art|artists?|music\w*|writ(e|ing|ers?)|imagin\w*|design\w*|stor(y|ies)|films?|invent\w*|build(ing)? (things|anything)|express\w*|make things|ideas?)\b/i,
    seeds: ['anyone can make art and music', 'building things I could never build alone', 'new tools for imagination', 'bringing my ideas to life'] },
  { id: 'hope', pol: 1, treatment: 'dawn breaks behind the hill and birds cross the sky',
    kw: /\b(abundan\w*|flourish\w*|utopia\w*|free time|leisure|prosper\w*|better world|potential|golden age|time with (my )?family|drudgery)\b/i,
    seeds: ['a better future for everyone', 'I am simply optimistic about what is coming', 'more time for the things that matter', 'it might just make life good'] },
  { id: 'pace', pol: -1, treatment: 'wind rises: clouds race and the rooftop mill spins',
    kw: /\b(too fast|so fast|how fast|speed|pace|rush\w*|racing|race|keep up|accelerat\w*|slow(ing)? down|overwhelm\w*|catch up|breakneck|no time to)\b/i,
    seeds: ['everything is changing too quickly', 'we cannot keep up with it', 'nobody is pausing to think', 'it is all happening faster than we can adapt'] },
  { id: 'environment', pol: -1, treatment: 'smoke thickens from the stacks behind the houses',
    kw: /\b(energy|electricit\w*|water|data ?cent\w*|emissions?|carbon|environment\w*|climate|planet|resources|pollut\w*|power grid)\b/i,
    seeds: ['the electricity and water all these computers use', 'the damage to the planet', 'data centres burning through resources', 'the carbon cost of it all'] },
];

export const BY_ID = Object.fromEntries(CONCEPTS.map(c => [c.id, c]));
export const TONE_ANCHORS = {
  hope: ['this gives me hope and I am excited about it', 'I think this will be wonderful for people'],
  fear: ['this frightens me and I am worried about it', 'I think this will go badly for people'],
};
