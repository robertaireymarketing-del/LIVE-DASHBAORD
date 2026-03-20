// Extracted data/constants to keep app.js smaller for AI-assisted edits.

const STOIC_QUOTES = [
      { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", interpretation: "Today's live stream numbers, the algorithm, customer responses — you can't control any of it. But you control showing up, your energy on camera, and your consistency. That's where TJM wins." },
      { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius", interpretation: "Stop planning the perfect content strategy. Stop tweaking the website. Go live. Send the DMs. Make the sales post. Execution beats perfection every single day." },
      { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius", interpretation: "That voice saying 'this won't work' or 'who am I to build this' — that's just noise. Replace it with: 'I'm building something real, one sale at a time.' Your thoughts shape your results." },
      { text: "It is not death that a man should fear, but he should fear never beginning to live.", author: "Marcus Aurelius", interpretation: "The 18-month hiatus is over. You're back in the arena now. Fear isn't failing at TJM — it's never finding out how far you could have taken it." },
      { text: "Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present.", author: "Marcus Aurelius", interpretation: "Don't spiral about hitting 1 sale/day by end of 90 days. Focus on today's live, today's DMs, today's workout. Stack enough todays and the future takes care of itself." },
      { text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", author: "Marcus Aurelius", interpretation: "You don't need 100k followers or a viral video to win. You need consistency, discipline, and the mental game locked in. Everything else is noise." },
      { text: "The soul becomes dyed with the colour of its thoughts.", author: "Marcus Aurelius", interpretation: "Every day you show up — gym, live stream, retention — you're programming yourself into someone who wins. Your identity is being forged right now through these habits." },
      { text: "When you arise in the morning, think of what a precious privilege it is to be alive — to breathe, to think, to enjoy, to love.", author: "Marcus Aurelius", interpretation: "4:30am. Most people are asleep. You're awake, building your empire while they dream. This early start isn't a burden — it's your competitive advantage." },
      { text: "If it is not right do not do it; if it is not true do not say it.", author: "Marcus Aurelius", interpretation: "TJM is 'luxury without the lies.' That's not just marketing — it's who you are. Honest pricing, real quality, no manipulation. The brand is the man." },
      { text: "The best revenge is not to be like your enemy.", author: "Marcus Aurelius", interpretation: "The jewelry industry is full of fake markups and deceptive pricing. Your revenge? Build something so transparent and valuable they can't compete. Success is the best response." },
      { text: "Confine yourself to the present.", author: "Marcus Aurelius", interpretation: "Not yesterday's missed workout. Not tomorrow's sales target. Just this live stream. Just this rep. Just this DM. The present moment is all you can actually influence." },
      { text: "Begin — to begin is half the work, let half still remain; again begin this, and thou wilt have finished.", author: "Marcus Aurelius", interpretation: "First live of the month? Done. Now begin again tomorrow. This is how 20 lives happen. This is how 10kg drops. Begin, and begin again." },
      { text: "No man is free who is not master of himself.", author: "Epictetus", interpretation: "Retention, early rising, gym discipline — these aren't restrictions, they're freedom. Mastering yourself means your future isn't dictated by impulses." },
      { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus", interpretation: "UK's richest self-made under 40. Say it. Believe it. Then do today's work like that person would. Identity precedes achievement." },
      { text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus", interpretation: "Zero viewers today? Use it as practice. No sales this week? Refine the pitch. Your response to setbacks determines whether they're permanent or temporary." },
      { text: "We suffer more often in imagination than in reality.", author: "Seneca", interpretation: "The fear of going live, the anxiety about sales — it's worse in your head than in reality. Hit the button. Start talking. The suffering dissolves in action." },
      { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca", interpretation: "Every live stream is preparation. Every DM is preparation. When the viral moment comes — and it will — you'll be ready because you showed up daily." },
      { text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca", interpretation: "Day 2 of 90. This day is its own complete story. Win it. Tomorrow gets its own chance. Stack 90 winning days and the transformation is inevitable." },
      { text: "If a man knows not to which port he sails, no wind is favorable.", author: "Seneca", interpretation: "1 sale/day. 10kg down. 20 lives. £400-500M valuation. You know exactly where you're going. Now every action either sails toward it or away." },
      { text: "The obstacle is the way.", author: "Marcus Aurelius", interpretation: "Dormant audience? It teaches you to re-engage. Limited time? It forces focus. Every constraint you face is actually training you for the next level." },
    ];

const BATCH_COLOURS = [
      {id:'red',        hex:'#e74c3c', label:'Red'},
      {id:'crimson',    hex:'#c0392b', label:'Crimson'},
      {id:'scarlet',    hex:'#ff2400', label:'Scarlet'},
      {id:'coral',      hex:'#ff6b6b', label:'Coral'},
      {id:'orange',     hex:'#e67e22', label:'Orange'},
      {id:'amber',      hex:'#f39c12', label:'Amber'},
      {id:'tangerine',  hex:'#ff8c00', label:'Tangerine'},
      {id:'peach',      hex:'#ffb347', label:'Peach'},
      {id:'yellow',     hex:'#f1c40f', label:'Yellow'},
      {id:'sunshine',   hex:'#ffd700', label:'Sunshine'},
      {id:'lime',       hex:'#a8d400', label:'Lime'},
      {id:'chartreuse', hex:'#7fff00', label:'Chartreuse'},
      {id:'green',      hex:'#2ecc71', label:'Green'},
      {id:'forest',     hex:'#27ae60', label:'Forest'},
      {id:'mint',       hex:'#00c9a7', label:'Mint'},
      {id:'emerald',    hex:'#1abc9c', label:'Emerald'},
      {id:'teal',       hex:'#16a085', label:'Teal'},
      {id:'cyan',       hex:'#00bcd4', label:'Cyan'},
      {id:'sky',        hex:'#3498db', label:'Sky Blue'},
      {id:'ocean',      hex:'#0288d1', label:'Ocean'},
      {id:'blue',       hex:'#2980b9', label:'Blue'},
      {id:'navy',       hex:'#1a237e', label:'Navy'},
      {id:'indigo',     hex:'#5b6bb0', label:'Indigo'},
      {id:'slate',      hex:'#546e7a', label:'Slate'},
      {id:'purple',     hex:'#9b59b6', label:'Purple'},
      {id:'violet',     hex:'#8e44ad', label:'Violet'},
      {id:'lavender',   hex:'#b39ddb', label:'Lavender'},
      {id:'mauve',      hex:'#ce93d8', label:'Mauve'},
      {id:'pink',       hex:'#e91e8c', label:'Pink'},
      {id:'rose',       hex:'#e84393', label:'Rose'},
      {id:'hotpink',    hex:'#ff4081', label:'Hot Pink'},
      {id:'blush',      hex:'#f48fb1', label:'Blush'},
      {id:'gold',       hex:'#C9A84C', label:'Gold'},
      {id:'bronze',     hex:'#cd7f32', label:'Bronze'},
      {id:'silver',     hex:'#95a5a6', label:'Silver'},
      {id:'pearl',      hex:'#bdc3c7', label:'Pearl'},
      {id:'ruby',       hex:'#9b1c31', label:'Ruby'},
      {id:'burgundy',   hex:'#800020', label:'Burgundy'},
      {id:'magenta',    hex:'#e91e63', label:'Magenta'},
      {id:'fuchsia',    hex:'#c71585', label:'Fuchsia'},
      {id:'plum',       hex:'#673ab7', label:'Plum'},
      {id:'midnight',   hex:'#1a1a2e', label:'Midnight'},
      {id:'cobalt',     hex:'#0047ab', label:'Cobalt'},
      {id:'sapphire',   hex:'#0f52ba', label:'Sapphire'},
      {id:'aqua',       hex:'#00e5ff', label:'Aqua'},
      {id:'turquoise',  hex:'#40e0d0', label:'Turquoise'},
      {id:'sage',       hex:'#7daa76', label:'Sage'},
      {id:'olive',      hex:'#808000', label:'Olive'},
      {id:'khaki',      hex:'#c8a951', label:'Khaki'},
      {id:'copper',     hex:'#b87333', label:'Copper'},
      {id:'rust',       hex:'#b7410e', label:'Rust'},
      {id:'wine',       hex:'#722f37', label:'Wine'},
      {id:'maroon',     hex:'#800000', label:'Maroon'},
      {id:'vermilion',  hex:'#e34234', label:'Vermilion'},
      {id:'pumpkin',    hex:'#ff7518', label:'Pumpkin'},
      {id:'mustard',    hex:'#e1ad01', label:'Mustard'},
      {id:'lemon',      hex:'#fff44f', label:'Lemon'},
      {id:'pistachio',  hex:'#93c572', label:'Pistachio'},
      {id:'jade',       hex:'#00a550', label:'Jade'},
      {id:'spruce',     hex:'#4f7942', label:'Spruce'},
      {id:'arctic',     hex:'#81d4fa', label:'Arctic'},
      {id:'periwinkle', hex:'#ccccff', label:'Periwinkle'},
      {id:'denim',      hex:'#1560bd', label:'Denim'},
      {id:'eggplant',   hex:'#614051', label:'Eggplant'},
      {id:'charcoal',   hex:'#36454f', label:'Charcoal'},
      {id:'ivory',      hex:'#fffff0', label:'Ivory'},
    ];

const RETENTION_SCIENCE = [
      { range:[1,1], phase:'Recalibration Begins', title:'The Reset', bullets:[{icon:'🧠',text:'Dopamine baseline starts to recalibrate — your brain is used to a spike, now it has to work without it.'},{icon:'⚡',text:'You may feel restless or edgy. This is withdrawal-adjacent — it\'s a sign your nervous system is rebalancing.'},{icon:'💪',text:'Testosterone begins its steady climb. Luteinising hormone (LH) is already signalling increased production.'}], deep:'Within 24 hours of retaining, your hypothalamus begins adjusting GnRH (gonadotropin-releasing hormone) pulses. This triggers the pituitary to increase LH output, which directly stimulates testicular Leydig cells to produce more testosterone. The dopamine system simultaneously starts withdrawing from over-stimulation patterns — similar neurologically to the first day of cutting caffeine.' },
      { range:[2,3], phase:'Hormonal Shift', title:'Early Energy Surge', bullets:[{icon:'🔥',text:'Norepinephrine rises — heightened alertness, sharper reactions, slight edge in social situations.'},{icon:'😤',text:'Possible irritability or aggression — this is androgen activity increasing. Channel it into the gym.'},{icon:'🌙',text:'Sleep quality may improve as your body reallocates recovery resources.'}], deep:'Days 2-3 see measurable increases in androgen receptor sensitivity. Your cells aren\'t just receiving more testosterone — they\'re becoming better at using it. Studies on sexual abstinence show cortisol temporarily spikes (explaining irritability) before normalising, while simultaneously DHT levels begin to rise, affecting confidence and assertiveness circuits in the brain.' },
      { range:[4,6], phase:'Testosterone Spike', title:'Peak T Window', bullets:[{icon:'📈',text:'Research by Jiang et al. shows testosterone peaks around day 7 — you\'re approaching that window.'},{icon:'🎯',text:'Focus and drive noticeably sharper. Prefrontal cortex activity increases as dopamine pathways normalise.'},{icon:'💬',text:'Social confidence begins emerging — deeper voice resonance, stronger eye contact reported anecdotally.'}], deep:'The landmark Chinese study (Jiang et al., 2003) documented a ~45% increase in serum testosterone on day 7 of abstinence. The mechanism involves LH pulse amplitude increasing significantly, overwhelming normal negative feedback. Additionally, androgen receptors in the brain — particularly in the limbic system — become upregulated, making you more sensitive to your own testosterone even before the peak.' },
      { range:[7,7], phase:'Peak Testosterone', title:'Day 7 — The Peak', bullets:[{icon:'🏆',text:'Scientifically documented testosterone peak. Jiang et al. measured ~145-155% of baseline in study participants.'},{icon:'🧬',text:'Androgen receptor density at its highest — your body is maximally primed to respond to T.'},{icon:'💡',text:'Cognitive performance — working memory, pattern recognition — measurably sharpened in studies.'}], deep:'Day 7 is the most scientifically substantiated milestone in abstinence research. The Jiang study (published in the Journal of Zhejiang University) found testosterone levels in abstaining men were approximately 45.7% higher than baseline on day 7, then normalised. This spike has downstream effects: increased haemoglobin production (more oxygen to muscles), enhanced IGF-1 (growth factor), and measurably higher aggression and competitiveness scores in psychological testing.' },
      { range:[8,13], phase:'Integration Phase', title:'The Plateau', bullets:[{icon:'🔄',text:'Testosterone normalises but androgen receptor upregulation remains — your sensitivity stays elevated.'},{icon:'🧠',text:'Dopamine receptors continue recovering. Motivation for real-world rewards (gym, business) increases.'},{icon:'😴',text:'Deep sleep architecture improves — more time in slow-wave sleep where GH is released.'}], deep:'After the day-7 peak, testosterone returns toward baseline, but this doesn\'t mean regression. The lasting benefit is neurological: dopamine D2 receptors, which were desensitised by excessive stimulation, are measurably recovering. Research on porn addiction recovery (Kühn & Gallinat, 2014) shows reduced grey matter in the striatum from overuse — recovery at this stage involves measurable restoration of those pathways.' },
      { range:[14,20], phase:'Neurological Rewiring', title:'Two Week Mark', bullets:[{icon:'🌊',text:'Oxytocin sensitivity increases — you\'ll notice deeper connection in real social interactions.'},{icon:'🎯',text:'\"Monk mode\" effects peak here — laser focus, reduced need for external stimulation.'},{icon:'🦁',text:'Aura and presence reported heavily anecdotally — increased pheromone output is a plausible mechanism.'}], deep:'By week two, the prefrontal cortex is measurably more active in fMRI studies of abstaining individuals. This region governs impulse control, long-term planning, and social judgement — all of which report subjective improvement. Oxytocin receptor sensitivity increases make real human connection more rewarding, partially explaining why many practitioners report improved relationships and social magnetism at this stage.' },
      { range:[21,29], phase:'Sustained Recalibration', title:'Three Week Rewire', bullets:[{icon:'💎',text:'Myelin sheath formation accelerates — neural pathways for discipline and delayed gratification strengthen.'},{icon:'⚗️',text:'DHT levels stabilise at elevated baseline — affecting voice, hair, skin, muscle density.'},{icon:'🧘',text:'Emotional regulation significantly improved — less reactivity, more considered responses.'}], deep:'Three weeks marks a key threshold in habit neuroscience — it takes roughly 21 days for new neural pathways to begin myelination. The brain\'s reward circuitry is now rewired to derive more dopamine from achievement than consumption. DHT (dihydrotestosterone), converted from testosterone via 5-alpha reductase, reaches a new elevated baseline — this androgen is responsible for many of the physical effects practitioners report: stronger jaw, deeper voice, increased body hair, and enhanced muscle protein synthesis.' },
      { range:[30,59], phase:'Deep Transformation', title:'30 Day Mark', bullets:[{icon:'🔮',text:'Prolactin — the hormone that kills motivation and libido post-orgasm — remains chronically low.'},{icon:'💪',text:'Muscle synthesis optimised: elevated androgens + better sleep + higher IGF-1 = superior gains.'},{icon:'🧠',text:'Neuroplasticity at its highest — learning new skills, forming new habits is measurably easier.'}], deep:'Chronic low prolactin is perhaps the most underappreciated benefit at this stage. Prolactin suppresses dopamine, reduces testosterone, and creates the post-ejaculation "crash" — keeping it low means sustained motivation, drive, and libido (directed outward). Studies on prolactin\'s role in motivation circuits show it directly suppresses mesolimbic dopamine pathways. 30-day practitioners essentially have a chronically more dopaminergic brain.' },
      { range:[60,89], phase:'Elite Territory', title:'60 Day Warrior', bullets:[{icon:'🌟',text:'Serotonin and dopamine systems fully recalibrated — baseline mood significantly elevated.'},{icon:'🏋️',text:'Anabolic window optimised: testosterone, GH, IGF-1 all elevated simultaneously — peak muscle building conditions.'},{icon:'🎯',text:'Discipline compounds: each day adds to an identity shift — you become someone who keeps commitments.'}], deep:'At 60 days, the physiological changes are complemented by deep psychological shifts. Research on habit formation shows identity-level change requires roughly 60+ days of consistent behaviour — you are no longer someone "trying" to retain, you\'ve become someone who does. The neurological reward circuitry, now fully recalibrated, finds natural stimuli — competition, achievement, physical challenge — far more rewarding than before the practice began.' },
      { range:[90,999], phase:'Legend Territory', title:'90 Days+', bullets:[{icon:'👑',text:'Full neurological recalibration complete. Your brain\'s reward system is operating at its natural, uncompromised baseline.'},{icon:'🧬',text:'Epigenetic changes possible at this duration — gene expression related to androgen sensitivity may shift.'},{icon:'♾️',text:'The compounding effect: discipline, identity, hormonal profile and neurochemistry all aligned and optimised.'}], deep:'90 days is the traditional "reboot" milestone because research on neuroplasticity suggests this is approximately the time required for full dopaminergic recovery in the brain\'s reward circuitry. Some researchers hypothesise epigenetic mechanisms — DNA methylation patterns affecting androgen receptor gene expression — may begin to shift at this duration, permanently altering your hormonal sensitivity. You\'re not just abstaining anymore; you\'ve fundamentally changed your neurological baseline.' }
    ];

const VAULT_STAGES = ['Raw', 'Reviewed', 'Actioned', 'Archived'];

const VAULT_SOURCES = ['Video', 'Book', 'Podcast', 'Conversation', 'Article', 'Other'];

const VAULT_CATS = ['TJM', 'Personal', 'Other'];

const VAULT_STAGE_COLORS = { Raw: '#C9A84C', Reviewed: '#7EB8C9', Actioned: '#2ecc71', Archived: '#555' };

const VAULT_CAT_COLORS = { TJM: '#D4AF37', Personal: '#7EB8C9', Other: '#888' };

const VINTED_STAGES = ['Available Stock','Cleaning / Prep','To Photograph','To List','Listed','Sold / Awaiting Ship'];

export {
  STOIC_QUOTES,
  BATCH_COLOURS,
  RETENTION_SCIENCE,
  VAULT_STAGES,
  VAULT_SOURCES,
  VAULT_CATS,
  VAULT_STAGE_COLORS,
  VAULT_CAT_COLORS,
  VINTED_STAGES
};
