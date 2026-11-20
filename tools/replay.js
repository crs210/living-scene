// Replay a scripted audience, to test the director the same way every time.
//   node tools/replay.js <set> [batch=all] [port=3000]      e.g.  node tools/replay.js ai 1
// Each set is a list of batches. The answers are chosen to cover the KINDS of thing people say,
// because each kind should do something different to the picture:
//   named thing      -> arrives as itself and affects its surroundings
//   bare feeling     -> no new object; weather, light, repair, crowds
//   opinion          -> the act it implies (shut out, decided elsewhere)
//   question / doubt -> an absence (empty seat, signpost pointing every way)
//   memory / loss    -> a trace (empty chair, outline where something stood)
//   contradiction    -> both at once in one object
//   prediction       -> the place mid-change
//   process          -> the mechanism (road lengthening ahead of the walker)
//   repeat           -> no new drawing; the existing theme's weight rises
const SETS = {
  ai: [
    ['jobs disappearing', 'I worry my job will not exist in five years', 'it could cure diseases we have given up on', 'scary how fast it is moving', 'nobody asked us if we wanted this', 'kids growing up not knowing what is real'],
    ['my job again honestly', 'who gets the money when the work is gone?', 'excited for medicine', 'it feels like a wave we cannot stop', 'deepfakes and scams', 'I like that it helps me write'],
    ['jobs', 'the pace of it', 'hope it helps doctors', 'we should slow down', 'I do not trust the people building it', 'it might bring people together', 'what happens to people like me who cannot retrain?'],
  ],
  home: [
    ['the smell of my mum cooking', 'safe', 'somewhere I can finally stop performing', 'I have moved eleven times so honestly nowhere', 'my dog waiting at the door', 'a place I can no longer afford'],
    ['rent keeps going up', 'people, not a place', 'the house I grew up in was sold last year', 'loud and full of cousins', 'is it still home if everyone has left?', 'cannot afford to stay in my own town'],
    ['wherever my kids are', 'priced out', 'quiet', 'I am building one slowly, it is not finished', 'the kitchen table', 'it is both where I am from and where I had to leave'],
  ],
  city: [
    ['more trees', 'trams that actually turn up', 'I am scared to walk home at night', 'nowhere for teenagers to go', 'the river you can swim in', 'too many empty shops'],
    ['trees and shade', 'who is all this new housing for?', 'the market on Saturdays', 'cars everywhere', 'it used to feel like people knew each other', 'safer streets'],
    ['green everywhere', 'somewhere to sit that does not cost money', 'I think it is getting better honestly', 'empty shops again', 'kids playing outside', 'it will never change'],
  ],
};
const [set = 'ai', which = 'all', port = 3000] = process.argv.slice(2);
const batches = SETS[set]; if (!batches) { console.log('sets:', Object.keys(SETS).join(', ')); process.exit(1); }
const pick = which === 'all' ? batches.flat() : batches[Number(which) - 1] || [];
const r = await Promise.all(pick.map((text, i) => fetch(`http://localhost:${port}/api/submit`, { method: 'POST', body: JSON.stringify({ text, cid: `replay-${set}-${which}-${i}-${Date.now()}` }) }).then(x => x.json())));
console.log(`${r.filter(x => x.ok).length} of ${pick.length} accepted`, r.filter(x => !x.ok).map(x => x.reason).join(' | '));
