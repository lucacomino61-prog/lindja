// Privacy policy and terms of use for the prototype, in both languages. LINDJA is invented; these texts describe
// what this prototype really does with data (src/ui/forms.js, analytics.js, netlify/functions) and must be
// reviewed by a lawyer before any real use. {contact} is replaced by the company email the admin sets.
export default {
  sq: {
    toc: 'Në këtë faqe', back: 'Kthehu te faqja', updated: 'Përditësuar më', contact: 'emailin e kompanisë (vendoset nga kompania)',
    privacy: {
      title: 'Politika e privatësisë',
      description: 'Çfarë ruan prototipi LINDJA kur dërgon një formular, për sa kohë, dhe si funksionon matja anonime e vizitave.',
      intro: 'LINDJA është kompani e shpikur dhe kjo faqe është prototip. Formularët megjithatë funksionojnë: ajo që shkruan ruhet. Këtu shpjegojmë çfarë ruhet, pse dhe për sa kohë.',
      sections: [
        { h: 'Çfarë mbledhim', p: ['Kur rezervon një test drive ose porosit një makinë nga Koreja: emrin, telefonin, emailin, makinën ose modelin, buxhetin, datën, orën, sallonin dhe shënimin që shkruan. Nuk kërkojmë asgjë tjetër.'] },
        { h: 'Pse', p: ['Vetëm për të treguar si do të funksiononte paneli i kompanisë. Askush nuk do të të kontaktojë dhe të dhënat nuk përdoren për marketing.'] },
        { h: 'Për sa kohë', p: ['Çdo kërkesë fshihet vetë pas 30 ditësh. Administratori mund ta fshijë edhe më herët.'] },
        { h: 'Ku ruhen', p: ['Faqja dhe të dhënat ruhen te Netlify, Inc. (SHBA), që ofron hostimin. I sheh vetëm administratori i prototipit, pasi hyn me fjalëkalim.'] },
        { h: 'Matja e vizitave', p: ['Vetëm nëse pranon, numërojmë vizitat, klikimet në butonat kryesorë, sa formularë nisin dhe sa dërgohen, dhe nga vjen vizita (për shembull parametrat UTM të një lidhjeje). Ruajmë vetëm totale ditore: pa emër, pa adresë IP, pa identifikues dhe pa cookies. Totalet ruhen 13 muaj.', 'Mund ta ndryshosh zgjedhjen kurdo te “Cilësimet e privatësisë”, në fund të çdo faqeje.'] },
        { h: 'Mbrojtja nga mesazhet automatike', p: ['Për të kufizuar dërgimet dhe provat e fjalëkalimit, adresa IP kthehet në një kod të përzier (hash) që fshihet brenda rreth dy orësh. Adresa vetë nuk ruhet.'] },
        { h: 'Çfarë ruhet në pajisjen tënde', p: ['Në hapësirën lokale të shfletuesit (jo në cookies) ruhen vetëm zgjedhjet e tua: lëvizja e ndalur, ora e artë, pamja listë ose rrjetë, gjuha e panelit dhe vendimi për matjen. Paneli i administrimit përdor një cookie seance vetëm për administratorin.'] },
        { h: 'Të drejtat e tua', p: ['Mund të kërkosh të shohësh, të korrigjosh ose të fshish të dhënat e tua duke shkruar te {contact}. Gjithsesi, kërkesat fshihen vetë pas 30 ditësh.'] },
      ],
      note: 'Ky tekst përshkruan prototipin dhe duhet rishikuar nga një jurist para çdo përdorimi real.',
    },
    terms: {
      title: 'Kushtet e përdorimit',
      description: 'Kushtet për prototipin LINDJA: kompani e shpikur, çmime shembull, asnjë ofertë apo kontratë.',
      intro: 'Duke përdorur këtë faqe pranon kushtet më poshtë. Janë të shkurtra, sepse faqja është prototip.',
      sections: [
        { h: 'Një prototip', p: ['LINDJA është kompani e shpikur. Kjo faqe është prototip dizajni: nuk shet makina dhe nuk lidh asnjë kontratë.'] },
        { h: 'Çmimet dhe makinat', p: ['Çmimet, kilometrat dhe disponueshmëria janë shembuj. Fotot tregojnë llojin e makinës, jo modelin e saktë.'] },
        { h: 'Formularët', p: ['Një rezervim ose një kërkesë nuk është ofertë apo marrëveshje. Ruhet vetëm për demonstrim; shiko Politikën e privatësisë.'] },
        { h: 'Markat', p: ['Hyundai, Kia, Genesis dhe KGM u përkasin pronarëve të tyre. LINDJA nuk i përfaqëson.'] },
        { h: 'Modelet 3D dhe imazhet', p: ['Modelet 3D vijnë nga Sketchfab me licencë CC-BY 4.0; autorët janë te Kreditet e plota. Qiejt dhe sipërfaqet vijnë nga Poly Haven (CC0).'] },
        { h: 'Informacioni', p: ['Shpjegimet për doganën, kolaudimin dhe dokumentet janë të përgjithshme dhe mund të mos jenë të plota ose të përditësuara. Verifikoji para çdo vendimi real.'] },
        { h: 'Përdorimi i faqes', p: ['Mos e përdor faqen për të dërguar mesazhe automatike ose për ta mbingarkuar. Faqja mund të ndryshojë ose të hiqet në çdo kohë.'] },
      ],
      note: 'Ky tekst përshkruan prototipin dhe duhet rishikuar nga një jurist para çdo përdorimi real.',
    },
  },
  en: {
    toc: 'On this page', back: 'Back to the site', updated: 'Last updated', contact: 'the company’s email (set by the company)',
    privacy: {
      title: 'Privacy policy',
      description: 'What the LINDJA prototype keeps when you send a form, for how long, and how the anonymous visit counting works.',
      intro: 'LINDJA is an invented company and this site is a prototype. The forms still work: what you write is stored. This page explains what is kept, why and for how long.',
      sections: [
        { h: 'What we collect', p: ['When you book a test drive or order a car from Korea: your name, phone, email, the car or model, budget, date, time, showroom and the note you write. Nothing else is asked for.'] },
        { h: 'Why', p: ['Only to show how the company’s admin would work. Nobody will contact you and the data is not used for marketing.'] },
        { h: 'For how long', p: ['Every request is deleted automatically after 30 days. The admin can delete it sooner.'] },
        { h: 'Where it is kept', p: ['The site and the data are hosted by Netlify, Inc. (USA). Only the prototype’s administrator can see them, after signing in with a password.'] },
        { h: 'Counting visits', p: ['Only if you accept, we count visits, clicks on the main buttons, how many forms are started and sent, and where a visit comes from (for example the UTM parameters of a link). We keep daily totals only: no name, no IP address, no identifier and no cookies. The totals are kept for 13 months.', 'You can change your choice at any time under “Privacy settings” at the bottom of every page.'] },
        { h: 'Protection from automated messages', p: ['To limit sending and password guessing, your IP address is turned into a scrambled code (a hash) that is deleted within about two hours. The address itself is not stored.'] },
        { h: 'What is kept on your device', p: ['The browser’s local storage (not cookies) keeps only your choices: motion stopped, golden hour, list or grid view, the admin language and your decision on counting. The admin uses a session cookie for the administrator only.'] },
        { h: 'Your rights', p: ['You can ask to see, correct or delete your data by writing to {contact}. In any case, requests are deleted automatically after 30 days.'] },
      ],
      note: 'This text describes the prototype and must be reviewed by a lawyer before any real use.',
    },
    terms: {
      title: 'Terms of use',
      description: 'Terms for the LINDJA prototype: an invented company, example prices, no offer or contract.',
      intro: 'By using this site you accept the terms below. They are short, because the site is a prototype.',
      sections: [
        { h: 'A prototype', p: ['LINDJA is an invented company. This site is a design prototype: it does not sell cars and makes no contract.'] },
        { h: 'Prices and cars', p: ['Prices, kilometres and availability are examples. Photos show the body type, not the exact model.'] },
        { h: 'Forms', p: ['A booking or a request is not an offer or an agreement. It is kept for the demo only; see the Privacy policy.'] },
        { h: 'Brands', p: ['Hyundai, Kia, Genesis and KGM belong to their owners. LINDJA does not represent them.'] },
        { h: '3D models and images', p: ['The 3D models come from Sketchfab under CC-BY 4.0; the authors are listed in the full credits. Skies and surfaces come from Poly Haven (CC0).'] },
        { h: 'Information', p: ['The explanations about customs, the technical inspection and the papers are general and may be incomplete or out of date. Check them before any real decision.'] },
        { h: 'Using the site', p: ['Don’t use the site to send automated messages or to overload it. The site may change or be taken down at any time.'] },
      ],
      note: 'This text describes the prototype and must be reviewed by a lawyer before any real use.',
    },
  },
};
