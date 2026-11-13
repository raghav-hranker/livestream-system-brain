// Snapshot of what arvidyagram.com serves today (2026-11-05). Copy and claims are the site's, not new ones.
const VARIANTS = {};
const inr = n => '₹' + Number(n).toLocaleString('en-IN');

const VG = {
  logo: 'assets/vidyagram-logo.png',
  founderCut: 'assets/aditya-ranjan-sir-founder-of-vidyagram.png',
  whatsapp: '+91 88600 42427',
  ticker: [
    ['NEW', 'Champions 5.0 — Maths Special live batch by Aditya Sir'],
    ['NEW', 'Combo Special — SSC CGL Mains Batch 2026'],
    ['NEW', 'Railway Foundation 2026-27 2.0 Batch'],
    ['NEW', 'Bihar Foundation Batch 2026-27'],
    ['BATCH', 'SSC GD 2027 (भारत Batch)'],
    ['FREE', 'Daily Quiz — fresh questions every day'],
  ],
  stats: [
    ['20+ Lakh', 'Registered students'],
    ['50 CR+', 'Monthly views'],
    ['5+ Crore', 'Tests attempted'],
    ['10K+', 'Selections'],
  ],
  examFilters: [
    ['all', 'All exams'], ['ssc', 'SSC'], ['rail', 'Railways'], ['up', 'UP exams'], ['bihar', 'Bihar'],
  ],
  courses: [
    { id: 'champ', title: 'Champions 5.0', hi: 'Maths Special', sub: 'Arithmetic + Advance · Pre + Mains', teacher: 'Aditya Ranjan Sir', exams: 'All exams', groups: ['ssc', 'rail', 'up', 'bihar'], price: 899, mrp: 1999, img: 'assets/c-champions.jpg', status: 'LIVE', note: 'Started 01 Oct · 2-year validity' },
    { id: 'vande', title: 'Railway Foundation 2026-27', hi: 'वन्दे भारत 2.0', sub: 'Zero to hero combo', teacher: 'Aditya, Akash, Shubham + team', exams: 'NTPC · Group D · ALP · RPF', groups: ['rail'], price: 1199, mrp: 5999, img: 'assets/c-railway.png', status: 'OPEN', note: 'Live classes · all subjects' },
    { id: 'cgl', title: 'Combo Special', hi: 'SSC CGL Mains 2026', sub: 'Maths, English, Reasoning, Computer', teacher: 'Team Vidyagram', exams: 'SSC CGL Mains', groups: ['ssc'], price: 1999, img: 'assets/c-cgl.jpg', status: 'OPEN', note: 'Complete Mains combo' },
    { id: 'pet', title: 'UPSSSC PET 2026', hi: 'क्रैश कोर्स', sub: 'Every subject till exam day', teacher: 'Aditya, Akash + team', exams: 'UPSSSC PET', groups: ['up'], price: 149, mrp: 999, img: 'assets/c-pet.jpg', status: 'OPEN', note: 'Valid till the exam' },
    { id: 'mains', title: 'UPSSSC Mains All-in-One', hi: 'Foundation 2026-27', sub: 'One batch for all UPSSSC Mains', teacher: 'Team Vidyagram', exams: 'UPSSSC Mains', groups: ['up'], price: 799, img: 'assets/c-upsssc-mains.jpg', status: 'OPEN', note: '24-month validity' },
    { id: 'upsi', title: 'UPSI भर्ती', hi: 'दरोगा जी Batch', sub: '2026-27 sub-inspector batch', teacher: 'Team Vidyagram', exams: 'UP SI', groups: ['up'], price: 799, mrp: 999, img: 'assets/c-upsi.jpg', status: 'OPEN', note: 'Live + recorded' },
    { id: 'varadi', title: 'UP Police Constable 2027', hi: 'मिशन वर्दी बैच', sub: 'Full constable preparation', teacher: 'Team Vidyagram', exams: 'UP Police', groups: ['up'], price: 599, mrp: 999, img: 'assets/c-mission.jpg', status: 'OPEN', note: 'Live + recorded' },
    { id: 'bihar', title: 'Bihar Foundation', hi: 'Batch 2026-27', sub: 'State-level foundation', teacher: 'Team Vidyagram', exams: 'Bihar exams', groups: ['bihar'], price: 799, img: 'assets/c-bihar.jpg', status: 'OPEN', note: 'Live + recorded' },
    { id: 'gk', title: 'Static GK 3.0', hi: 'Shubham Grover Ma\'am', sub: 'Static GK for all exams', teacher: 'Shubham Ma\'am', exams: 'All exams', groups: ['ssc', 'rail', 'up', 'bihar'], price: 99, img: 'assets/c-gk.jpg', status: 'OPEN', note: 'Recorded batch' },
    { id: 'reason', title: 'Reasoning Special 4.0', hi: 'Akash Chaturvedi Sir', sub: 'Verbal + non-verbal', teacher: 'Akash Sir', exams: 'All exams', groups: ['ssc', 'rail', 'bihar'], price: 899, img: 'assets/c-reasoning.jpg', status: 'OPEN', note: 'Live + recorded' },
    { id: 'eng', title: 'English Special 4.0', hi: 'Jai Sir', sub: 'For all govt. exams', teacher: 'Jai Sir', exams: 'All exams', groups: ['ssc', 'rail'], price: 899, img: 'assets/c-english.jpg', status: 'OPEN', note: 'Live + recorded' },
  ],
  teachers: [
    { name: 'Aditya Ranjan Sir', short: 'Aditya Sir', subject: 'Maths', img: 'assets/t-aditya.jpg' },
    { name: 'Shubham Ma\'am', short: 'Shubham Ma\'am', subject: 'GK/GS', img: 'assets/t-shubham.jpg' },
    { name: 'Akash Sir', short: 'Akash Sir', subject: 'Reasoning', img: 'assets/t-akash.jpg' },
    { name: 'Pushpendra Sir', short: 'Pushpendra Sir', subject: 'Science', img: 'assets/t-pushpendra.jpg' },
    { name: 'Arti Ma\'am', short: 'Arti Ma\'am', subject: 'Science', img: 'assets/t-arti.jpg' },
    { name: 'Jai Sir', short: 'Jai Sir', subject: 'English', img: 'assets/t-jai.jpg' },
    { name: 'Ajeet Sir', short: 'Ajeet Sir', subject: 'Polity', img: 'assets/t-ajeet.jpg' },
    { name: 'Deepak Sir', short: 'Deepak Sir', subject: 'GK/GS', img: 'assets/t-deepak.jpg' },
    { name: 'Ankit Sir', short: 'Ankit Sir', subject: 'GK/GS', img: 'assets/t-ankit.jpg' },
    { name: 'Pulkit Sir', short: 'Pulkit Sir', subject: 'Reasoning', img: 'assets/t-pulkit.jpg' },
    { name: 'Mohit Sir', short: 'Mohit Sir', subject: 'Hindi', img: 'assets/t-mohit.jpg' },
  ],
  books: [
    { title: 'Vocab रणभूमि', by: 'Jai Sir', price: 127, mrp: 200, img: 'assets/b-vocab.jpg' },
    { title: 'Calculation Booster', by: 'Aditya Ranjan Sir', price: 142, mrp: 150, img: 'assets/b-calc.jpg' },
    { title: 'UPSSSC PET', by: 'Aditya Ranjan Sir', price: 127, mrp: 300, img: 'assets/b-pet.jpg' },
    { title: 'UPSSSC DI', by: 'Aditya Ranjan Sir', price: 78, mrp: 150, img: 'assets/b-di.jpg' },
    { title: 'Railway General Science', by: 'Aditya Ranjan Sir', price: 219, mrp: 350, img: 'assets/b-sci.jpg' },
  ],
  classes: [
    { title: 'Daily Current Affairs', by: 'Shubham Ma\'am', quiz: '10 Qs · 5 min', len: '1:04:20', tag: 'LIVE AT 7 AM', img: 'assets/daily-current-affairs-2-oct-youtube-class-thumbn.jpg' },
    { title: 'Maths Special — Percentage tricks', by: 'Aditya Ranjan Sir', quiz: '10 Qs · 8 min', len: '58:12', img: 'assets/maths-special-percentage-tricks-youtube-class-th.jpg' },
    { title: 'Static GK — Indian rivers & dams', by: 'Shubham Ma\'am', quiz: '15 Qs · 7 min', len: '46:30', img: 'assets/static-gk-indian-rivers-dams-youtube-class-thumb.jpg' },
  ],
  free: [
    ['Daily Quiz', 'Based on today\'s YouTube classes'],
    ['AI Test', 'Practice tests made for you'],
    ['Current Affairs', 'Today\'s news + MCQs, हिंदी & English'],
    ['PYQ Papers', 'Solved previous year papers'],
    ['Ebooks', 'Free PDFs to read offline'],
    ['Rank Calculator', 'See where you stand in your exam'],
  ],
  stories: [
    { name: 'Dhruv Rana', rank: 'AIR 01', exam: 'SSC CGL 2025', post: 'Income Tax Inspector', img: 'assets/dhruv-rana.jpg', quote: 'Every day I solved the daily quiz and one full mock. Aditya sir told me to trust the process.' },
    { name: 'Aman Verma', rank: 'AIR 312', exam: 'SSC CGL 2025', post: 'Income Tax Inspector', img: 'assets/aman-verma.jpg', quote: 'Aditya sir’s maths tricks cut my calculation time in half. The daily quiz kept me consistent.' },
    { name: 'Karan Sharma', rank: 'SELECTED', exam: 'RRB NTPC 2025', post: 'Station Master', img: 'assets/karan-sharma.jpg', quote: 'I studied only on my phone. The PYQ papers and mock tests here were exactly exam level.' },
    { name: 'Rohit Yadav', rank: 'SELECTED', exam: 'UP Police 2025', post: 'Constable', img: 'assets/rohit-yadav.jpg', quote: 'Current affairs in Hindi every morning was my routine. GK became my easiest section.' },
  ],
};
