/* Lightweight i18n for the Khoya-Paya portal.
   - STR holds every UI string keyed by name, with 5 languages.
   - t(key) returns the string in the active language (falls back to English).
   - applyLang() translates all [data-i18n] / [data-i18n-ph] nodes and fires
     a "kp:lang" event so JS-rendered widgets can re-render.
   Language choice is persisted in localStorage and shared across all pages. */
(function(){
const LANGS=[["en","English"],["hi","हिन्दी"],["mr","मराठी"],["gu","ગુજરાતી"],["ta","தமிழ்"]];
const STR={
 gov:{en:"Government of India",hi:"भारत सरकार",mr:"भारत सरकार",gu:"ભારત સરકાર",ta:"இந்திய அரசு"},
 skip:{en:"Skip to Main Content",hi:"मुख्य सामग्री पर जाएं",mr:"मुख्य मजकुराकडे जा",gu:"મુખ્ય સામગ્રી પર જાઓ",ta:"முதன்மை உள்ளடக்கத்திற்கு செல்க"},
 lang:{en:"Language",hi:"भाषा",mr:"भाषा",gu:"ભાષા",ta:"மொழி"},
 org:{en:"Nashik–Trimbakeshwar Kumbh Mela Authority · Maharashtra Police · Dept. of Disaster Management",hi:"नासिक–त्र्यंबकेश्वर कुंभ मेळा प्राधिकरण · महाराष्ट्र पुलिस · आपदा प्रबंधन विभाग",mr:"नाशिक–त्र्यंबकेश्वर कुंभमेळा प्राधिकरण · महाराष्ट्र पोलीस · आपत्ती व्यवस्थापन विभाग",gu:"નાશિક–ત્ર્યંબકેશ્વર કુંભ મેળા સત્તામંડળ · મહારાષ્ટ્ર પોલીસ · આપત્તિ વ્યવસ્થાપન વિભાગ",ta:"நாசிக்–திரியம்பகேஸ்வர் கும்பமேளா ஆணையம் · மகாராஷ்டிரா காவல்துறை · பேரிடர் மேலாண்மை துறை"},
 title_desc:{en:"Khoya-Paya — Kumbh Mela Missing Person Tracing System",hi:"खोया-पाया — कुंभ मेळा गुमशुदा व्यक्ति खोज प्रणाली",mr:"खोया-पाया — कुंभमेळा हरवलेली व्यक्ती शोध प्रणाली",gu:"ખોયા-પાયા — કુંભ મેળા ગુમ વ્યક્તિ શોધ સિસ્ટમ",ta:"கோயா-பாயா — கும்பமேளா காணாமல் போனோர் தேடல் அமைப்பு"},
 brand_native:{en:"Khoya-Paya · Missing Person Tracing",hi:"खोया-पाया · गुमशुदा व्यक्ति खोज",mr:"खोया-पाया · हरवलेली व्यक्ती शोध",gu:"ખોયા-પાયા · ગુમ વ્યક્તિ શોધ",ta:"கோயா-பாயா · காணாமல் போனோர் தேடல்"},
 seal:{en:"An official command & control system for pilgrim safety",hi:"तीर्थयात्री सुरक्षा हेतु आधिकारिक कमांड एवं नियंत्रण प्रणाली",mr:"भाविक सुरक्षेसाठी अधिकृत कमांड व नियंत्रण प्रणाली",gu:"યાત્રાળુ સુરક્ષા માટે અધિકૃત કમાન્ડ અને નિયંત્રણ સિસ્ટમ",ta:"யாத்ரீகர் பாதுகாப்புக்கான அதிகாரப்பூர்வ கட்டளை அமைப்பு"},

 nav_command:{en:"Command Center",hi:"कमांड सेंटर",mr:"कमांड सेंटर",gu:"કમાન્ડ સેન્ટર",ta:"கட்டளை மையம்"},
 nav_register:{en:"Missing Register",hi:"गुमशुदा रजिस्टर",mr:"हरवलेले रजिस्टर",gu:"ગુમ રજિસ્ટર",ta:"காணாமல் பதிவேடு"},
 nav_cctv:{en:"CCTV Grid",hi:"सीसीटीवी ग्रिड",mr:"सीसीटीव्ही ग्रिड",gu:"સીસીટીવી ગ્રિડ",ta:"சிசிடிவி கட்டம்"},
 nav_zone:{en:"Zone Risk",hi:"ज़ोन जोखिम",mr:"झोन जोखीम",gu:"ઝોન જોખમ",ta:"மண்டல ஆபத்து"},
 nav_vol:{en:"Volunteers",hi:"स्वयंसेवक",mr:"स्वयंसेवक",gu:"સ્વયંસેવકો",ta:"தன்னார்வலர்கள்"},
 btn_report:{en:"File New Report",hi:"नई रिपोर्ट दर्ज करें",mr:"नवीन तक्रार नोंदवा",gu:"નવી રિપોર્ટ નોંધાવો",ta:"புதிய புகார் பதிவு"},
 btn_login:{en:"Staff Login",hi:"स्टाफ लॉगिन",mr:"कर्मचारी लॉगिन",gu:"સ્ટાફ લૉગિન",ta:"ஊழியர் உள்நுழைவு"},
 yolo:{en:"CCTV AI",hi:"सीसीटीवी एआई",mr:"सीसीटीव्ही एआय",gu:"સીસીટીવી એઆઈ",ta:"சிசிடிவி AI"},
 on:{en:"ON",hi:"चालू",mr:"चालू",gu:"ચાલુ",ta:"இயக்கம்"},
 off:{en:"OFF",hi:"बंद",mr:"बंद",gu:"બંધ",ta:"அணைப்பு"},
 live:{en:"LIVE OPERATIONS",hi:"लाइव संचालन",mr:"थेट कार्यवाही",gu:"લાઇવ કામગીરી",ta:"நேரடி செயல்பாடு"},

 kpi_reports:{en:"Reports",hi:"रिपोर्ट",mr:"तक्रारी",gu:"રિપોર્ટ",ta:"புகார்கள்"},
 kpi_reunited:{en:"Reunited",hi:"पुनर्मिलन",mr:"पुनर्भेट",gu:"પુનઃમિલન",ta:"இணைந்தோர்"},
 kpi_open:{en:"Open / active",hi:"सक्रिय",mr:"सक्रिय",gu:"સક્રિય",ta:"செயலில்"},
 kpi_cctv:{en:"CCTV",hi:"सीसीटीवी",mr:"सीसीटीव्ही",gu:"સીસીટીવી",ta:"சிசிடிவி"},
 kpi_police:{en:"Police",hi:"पुलिस",mr:"पोलीस",gu:"પોલીસ",ta:"காவல்"},
 kpi_vol:{en:"Volunteers",hi:"स्वयंसेवक",mr:"स्वयंसेवक",gu:"સ્વયંસેવકો",ta:"தன்னார்வலர்கள்"},
 kpi_zones:{en:"Zones",hi:"ज़ोन",mr:"झोन",gu:"ઝોન",ta:"மண்டலங்கள்"},

 sec_filters:{en:"Filters",hi:"फ़िल्टर",mr:"फिल्टर",gu:"ફિલ્ટર",ta:"வடிகட்டிகள்"},
 lbl_search:{en:"Search name / case / location",hi:"नाम / केस / स्थान खोजें",mr:"नाव / केस / ठिकाण शोधा",gu:"નામ / કેસ / સ્થળ શોધો",ta:"பெயர் / வழக்கு / இடம் தேடு"},
 ph_search:{en:"e.g. Ramkund, Savita, KMP-2027…",hi:"उदा. Ramkund, Savita, KMP-2027…",mr:"उदा. Ramkund, Savita, KMP-2027…",gu:"દા.ત. Ramkund, Savita, KMP-2027…",ta:"எ.கா. Ramkund, Savita, KMP-2027…"},
 lbl_status:{en:"Status",hi:"स्थिति",mr:"स्थिती",gu:"સ્થિતિ",ta:"நிலை"},
 lbl_age:{en:"Age band",hi:"आयु वर्ग",mr:"वयोगट",gu:"વય જૂથ",ta:"வயது வரம்பு"},
 lbl_gender:{en:"Gender",hi:"लिंग",mr:"लिंग",gu:"જાતિ",ta:"பாலினம்"},
 lbl_loc:{en:"Last-seen location",hi:"अंतिम बार देखा गया स्थान",mr:"शेवटचे दिसलेले ठिकाण",gu:"છેલ્લે જોવાયેલ સ્થળ",ta:"கடைசியாக கண்ட இடம்"},
 sec_layers:{en:"Map Layers",hi:"मानचित्र परतें",mr:"नकाशा स्तर",gu:"નકશા સ્તરો",ta:"வரைபட அடுக்குகள்"},
 sec_register:{en:"Case Register",hi:"केस रजिस्टर",mr:"केस रजिस्टर",gu:"કેસ રજિસ્ટર",ta:"வழக்கு பதிவேடு"},
 shown:{en:"shown",hi:"दिखाए गए",mr:"दर्शविले",gu:"બતાવેલ",ta:"காட்டப்பட்டது"},

 lay_missing:{en:"Missing reports",hi:"गुमशुदा रिपोर्ट",mr:"हरवलेल्या तक्रारी",gu:"ગુમ રિપોર્ટ",ta:"காணாமல் புகார்கள்"},
 lay_heat:{en:"Missing heatmap",hi:"गुमशुदा हीटमैप",mr:"हरवलेले हीटमॅप",gu:"ગુમ હીટમેપ",ta:"வெப்ப வரைபடம்"},
 lay_cctv:{en:"CCTV cameras",hi:"सीसीटीवी कैमरे",mr:"सीसीटीव्ही कॅमेरे",gu:"સીસીટીવી કેમેરા",ta:"சிசிடிவி கேமராக்கள்"},
 lay_police:{en:"Police stations",hi:"पुलिस स्टेशन",mr:"पोलीस ठाणे",gu:"પોલીસ સ્ટેશન",ta:"காவல் நிலையங்கள்"},
 lay_vol:{en:"Volunteers",hi:"स्वयंसेवक",mr:"स्वयंसेवक",gu:"સ્વયંસેવકો",ta:"தன்னார்வலர்கள்"},
 lay_choke:{en:"Chokepoints / parking",hi:"चोकपॉइंट / पार्किंग",mr:"चोकपॉइंट / पार्किंग",gu:"ચોકપોઇન્ટ / પાર્કિંગ",ta:"நெரிசல் / நிறுத்தம்"},
 lay_zones:{en:"Zone risk index",hi:"ज़ोन जोखिम सूचकांक",mr:"झोन जोखीम निर्देशांक",gu:"ઝોન જોખમ સૂચકાંક",ta:"மண்டல ஆபத்து குறியீடு"},
 lay_blind:{en:"CCTV blind-spots",hi:"सीसीटीवी ब्लाइंड-स्पॉट",mr:"सीसीटीव्ही ब्लाइंड-स्पॉट",gu:"સીસીટીવી બ્લાઇન્ડ-સ્પોટ",ta:"சிசிடிவி குருட்டுப் புள்ளிகள்"},

 leg_title:{en:"Legend",hi:"संकेत-सूची",mr:"चिन्हसूची",gu:"દંતકથા",ta:"விளக்கம்"},
 leg_unresolved:{en:"Unresolved",hi:"अनसुलझा",mr:"निराकरण न झालेले",gu:"વણઉકેલ્યું",ta:"தீர்க்கப்படாதது"},
 leg_pending:{en:"Pending",hi:"लंबित",mr:"प्रलंबित",gu:"બાકી",ta:"நிலுவையில்"},
 leg_hospital:{en:"Hospital / CCTV",hi:"अस्पताल / सीसीटीवी",mr:"रुग्णालय / सीसीटीव्ही",gu:"હોસ્પિટલ / સીસીટીવી",ta:"மருத்துவமனை / சிசிடிவி"},
 leg_zone:{en:"Zone risk ring",hi:"ज़ोन जोखिम वलय",mr:"झोन जोखीम वर्तुळ",gu:"ઝોન જોખમ વર્તુળ",ta:"மண்டல ஆபத்து வளையம்"},
 leg_vol:{en:"Volunteer (free / busy)",hi:"स्वयंसेवक (खाली / व्यस्त)",mr:"स्वयंसेवक (मोकळा / व्यस्त)",gu:"સ્વયંસેવક (ફ્રી / વ્યસ્ત)",ta:"தன்னார்வலர் (கிடைக்கும் / பணியில்)"},
 leg_flag:{en:"CCTV AI flag (YOLO)",hi:"सीसीटीवी एआई फ्लैग (YOLO)",mr:"सीसीटीव्ही एआय फ्लॅग (YOLO)",gu:"સીસીટીવી એઆઈ ફ્લેગ (YOLO)",ta:"சிசிடிவி AI கொடி (YOLO)"},

 cc_select:{en:"Select a case",hi:"एक केस चुनें",mr:"एक केस निवडा",gu:"એક કેસ પસંદ કરો",ta:"ஒரு வழக்கைத் தேர்ந்தெடுக்கவும்"},
 cc_help:{en:"Pick a report from the register or a pin on the map to launch the decision-support workflow — search-radius prediction, CCTV recommendation, nearest response unit, likely route & similar cases.",hi:"रजिस्टर से कोई रिपोर्ट या मानचित्र पर पिन चुनें — खोज-त्रिज्या भविष्यवाणी, सीसीटीवी अनुशंसा, निकटतम प्रतिक्रिया इकाई, संभावित मार्ग व समान केस।",mr:"रजिस्टरमधून तक्रार किंवा नकाशावरील पिन निवडा — शोध-त्रिज्या अंदाज, सीसीटीव्ही शिफारस, जवळचे प्रतिसाद पथक, संभाव्य मार्ग व समान केसेस.",gu:"રજિસ્ટરમાંથી રિપોર્ટ અથવા નકશા પરનો પિન પસંદ કરો — શોધ-ત્રિજ્યા આગાહી, સીસીટીવી ભલામણ, નજીકનું પ્રતિસાદ એકમ, સંભવિત માર્ગ અને સમાન કેસ.",ta:"பதிவேட்டில் ஒரு புகார் அல்லது வரைபடப் பின்னைத் தேர்ந்தெடுக்கவும் — தேடல்-ஆரம் கணிப்பு, சிசிடிவி பரிந்துரை, அருகிலுள்ள பதில் அலகு, சாத்தியமான பாதை மற்றும் ஒத்த வழக்குகள்."},
 cc_search:{en:"AI Search-Radius Prediction",hi:"एआई खोज-त्रिज्या भविष्यवाणी",mr:"एआय शोध-त्रिज्या अंदाज",gu:"એઆઈ શોધ-ત્રિજ્યા આગાહી",ta:"AI தேடல்-ஆரம் கணிப்பு"},
 cc_cctv:{en:"CCTV Cameras to Review",hi:"समीक्षा हेतु सीसीटीवी कैमरे",mr:"तपासणीसाठी सीसीटीव्ही कॅमेरे",gu:"સમીક્ષા માટે સીસીટીવી કેમેરા",ta:"ஆய்வுக்கான சிசிடிவி கேமராக்கள்"},
 cc_vehicle:{en:"Police Vehicle Response",hi:"पुलिस वाहन प्रतिक्रिया",mr:"पोलीस वाहन प्रतिसाद",gu:"પોલીસ વાહન પ્રતિસાદ",ta:"காவல் வாகன பதில்"},
 cc_route:{en:"Likely Movement Route",hi:"संभावित गति मार्ग",mr:"संभाव्य हालचाल मार्ग",gu:"સંભવિત હિલચાલ માર્ગ",ta:"சாத்தியமான நகர்வு பாதை"},
 cc_similar:{en:"Similar Past Cases",hi:"समान पुराने केस",mr:"समान जुने केस",gu:"સમાન ભૂતકાળના કેસ",ta:"ஒத்த கடந்த வழக்குகள்"},
 cc_dispatch:{en:"Auto-Dispatch Log",hi:"स्वतः-प्रेषण लॉग",mr:"स्वयं-प्रेषण नोंद",gu:"ઓટો-ડિસ્પેચ લોગ",ta:"தானியங்கி அனுப்பு பதிவு"},
 cc_dispatch_btn:{en:"Dispatch volunteers & police now",hi:"अभी स्वयंसेवक व पुलिस भेजें",mr:"आता स्वयंसेवक व पोलीस पाठवा",gu:"હમણાં સ્વયંસેવકો અને પોલીસ મોકલો",ta:"இப்போது தன்னார்வலர் & காவலரை அனுப்பு"},
 cc_unit:{en:"Dispatch unit",hi:"प्रेषण इकाई",mr:"प्रेषण पथक",gu:"ડિસ્પેચ એકમ",ta:"அனுப்பு அலகு"},
 cc_straight:{en:"Straight-line",hi:"सीधी रेखा",mr:"सरळ रेषा",gu:"સીધી રેખા",ta:"நேர்கோடு"},
 cc_roaddist:{en:"Road distance",hi:"सड़क दूरी",mr:"रस्ता अंतर",gu:"રસ્તા અંતર",ta:"சாலை தூரம்"},
 cc_eta:{en:"Drive ETA (road)",hi:"वाहन समय (सड़क)",mr:"वाहन वेळ (रस्ता)",gu:"ડ્રાઇવ સમય (રસ્તો)",ta:"வாகன நேரம் (சாலை)"},
 cc_zone:{en:"Zone",hi:"ज़ोन",mr:"झोन",gu:"ઝોન",ta:"மண்டலம்"},
 cc_replay:{en:"▶ Replay vehicle route",hi:"▶ वाहन मार्ग पुनः चलाएं",mr:"▶ वाहन मार्ग पुन्हा दाखवा",gu:"▶ વાહન માર્ગ ફરી ચલાવો",ta:"▶ வாகன பாதையை மீண்டும் இயக்கு"},
 cc_routing:{en:"routing…",hi:"मार्ग खोज रहे…",mr:"मार्ग शोधत आहे…",gu:"રૂટિંગ…",ta:"பாதை கணிக்கிறது…"},

 ft_about:{en:"About",hi:"परिचय",mr:"विषयी",gu:"વિશે",ta:"பற்றி"},
 ft_contact:{en:"Contact Control Room",hi:"नियंत्रण कक्ष संपर्क",mr:"नियंत्रण कक्ष संपर्क",gu:"કંટ્રોલ રૂમ સંપર્ક",ta:"கட்டுப்பாட்டு அறை தொடர்பு"},
 ft_rti:{en:"RTI",hi:"सूचना का अधिकार",mr:"माहिती अधिकार",gu:"માહિતી અધિકાર",ta:"தகவல் உரிமை"},
 ft_access:{en:"Accessibility",hi:"सुगम्यता",mr:"सुलभता",gu:"સુલભતા",ta:"அணுகல்தன்மை"},
 ft_terms:{en:"Terms of Use",hi:"उपयोग की शर्तें",mr:"वापर अटी",gu:"વપરાશ શરતો",ta:"பயன்பாட்டு விதிமுறைகள்"},
 ft_help:{en:"Help: 112 / 1363",hi:"सहायता: 112 / 1363",mr:"मदत: 112 / 1363",gu:"મદદ: 112 / 1363",ta:"உதவி: 112 / 1363"},
 ft_owner:{en:"Website content owned & managed by Nashik Kumbh Mela Authority · © 2027",hi:"वेबसाइट सामग्री नासिक कुंभ मेळा प्राधिकरण द्वारा स्वामित्व व प्रबंधित · © 2027",mr:"संकेतस्थळ मजकूर नाशिक कुंभमेळा प्राधिकरणाच्या मालकीचे व व्यवस्थापित · © 2027",gu:"વેબસાઇટ સામગ્રી નાશિક કુંભ મેળા સત્તામંડળ દ્વારા સંચાલિત · © 2027",ta:"இணையதள உள்ளடக்கம் நாசிக் கும்பமேளா ஆணையத்தால் நிர்வகிக்கப்படுகிறது · © 2027"},

 /* ---- login page ---- */
 lg_authonly:{en:"Authorised personnel only",hi:"केवल अधिकृत कर्मचारी",mr:"केवळ अधिकृत कर्मचारी",gu:"ફક્ત અધિકૃત કર્મચારી",ta:"அங்கீகரிக்கப்பட்ட பணியாளர் மட்டும்"},
 lg_title:{en:"Khoya-Paya — Staff & Command Portal Login",hi:"खोया-पाया — स्टाफ व कमांड पोर्टल लॉगिन",mr:"खोया-पाया — कर्मचारी व कमांड पोर्टल लॉगिन",gu:"ખોયા-પાયા — સ્ટાફ અને કમાન્ડ પોર્ટલ લૉગિન",ta:"கோயா-பாயா — ஊழியர் & கட்டளை போர்ட்டல் உள்நுழைவு"},
 lg_native:{en:"Khoya-Paya · Staff Login",hi:"खोया-पाया · कर्मचारी लॉगिन",mr:"खोया-पाया · कर्मचारी लॉगिन",gu:"ખોયા-પાયા · સ્ટાફ લૉગિન",ta:"கோயா-பாயா · ஊழியர் உள்நுழைவு"},
 lg_head:{en:"🔐 Secure Sign-In",hi:"🔐 सुरक्षित साइन-इन",mr:"🔐 सुरक्षित साइन-इन",gu:"🔐 સુરક્ષિત સાઇન-ઇન",ta:"🔐 பாதுகாப்பான உள்நுழைவு"},
 lg_sub:{en:"Select your role and enter the access code",hi:"अपनी भूमिका चुनें और एक्सेस कोड दर्ज करें",mr:"तुमची भूमिका निवडा व अॅक्सेस कोड टाका",gu:"તમારી ભૂમિકા પસંદ કરો અને એક્સેસ કોડ દાખલ કરો",ta:"உங்கள் பணியைத் தேர்ந்தெடுத்து அணுகல் குறியீட்டை உள்ளிடவும்"},
 role_admin:{en:"Admin",hi:"एडमिन",mr:"अ‍ॅडमिन",gu:"એડમિન",ta:"நிர்வாகி"},
 role_police:{en:"Police",hi:"पुलिस",mr:"पोलीस",gu:"પોલીસ",ta:"காவல்"},
 role_volunteer:{en:"Volunteer",hi:"स्वयंसेवक",mr:"स्वयंसेवक",gu:"સ્વયંસેવક",ta:"தன்னார்வலர்"},
 lg_uid:{en:"Officer / Staff ID",hi:"अधिकारी / स्टाफ आईडी",mr:"अधिकारी / कर्मचारी आयडी",gu:"અધિકારી / સ્ટાફ આઈડી",ta:"அதிகாரி / ஊழியர் அடையாளம்"},
 lg_pwd:{en:"Access code",hi:"एक्सेस कोड",mr:"अॅक्सेस कोड",gu:"એક્સેસ કોડ",ta:"அணுகல் குறியீடு"},
 lg_signin:{en:"Sign In →",hi:"साइन इन →",mr:"साइन इन →",gu:"સાઇન ઇન →",ta:"உள்நுழை →"},
 lg_demo:{en:"Demo credentials",hi:"डेमो क्रेडेंशियल",mr:"डेमो क्रेडेन्शियल",gu:"ડેમો ઓળખપત્રો",ta:"டெமோ சான்றுகள்"},
 lg_back:{en:"← Back to public map",hi:"← सार्वजनिक मानचित्र पर लौटें",mr:"← सार्वजनिक नकाशाकडे परत",gu:"← જાહેર નકશા પર પાછા",ta:"← பொது வரைபடத்திற்கு திரும்பு"},
 lg_err:{en:"Invalid role / access code.",hi:"अमान्य भूमिका / एक्सेस कोड।",mr:"अवैध भूमिका / अॅक्सेस कोड.",gu:"અમાન્ય ભૂમિકા / એક્સેસ કોડ.",ta:"தவறான பணி / அணுகல் குறியீடு."},
 lg_unreach:{en:"Server unreachable — start the app with RUN.bat (Flask).",hi:"सर्वर अनुपलब्ध — RUN.bat से ऐप शुरू करें।",mr:"सर्व्हर उपलब्ध नाही — RUN.bat ने अ‍ॅप सुरू करा.",gu:"સર્વર પહોંચ બહાર — RUN.bat થી એપ શરૂ કરો.",ta:"சேவையகம் அணுக முடியவில்லை — RUN.bat மூலம் தொடங்கவும்."},

 /* ---- portal / table ---- */
 pt_restricted:{en:"Restricted · Case Register",hi:"प्रतिबंधित · केस रजिस्टर",mr:"प्रतिबंधित · केस रजिस्टर",gu:"પ્રતિબંધિત · કેસ રજિસ્ટર",ta:"கட்டுப்படுத்தப்பட்டது · வழக்கு பதிவேடு"},
 pt_title:{en:"Khoya-Paya — Reported Cases Register",hi:"खोया-पाया — दर्ज केस रजिस्टर",mr:"खोया-पाया — नोंदवलेले केस रजिस्टर",gu:"ખોયા-પાયા — નોંધાયેલ કેસ રજિસ્ટર",ta:"கோயா-பாயா — பதிவான வழக்கு பதிவேடு"},
 pt_org:{en:"Nashik–Trimbakeshwar Kumbh Mela Authority · Confidential operational data",hi:"नासिक–त्र्यंबकेश्वर कुंभ मेळा प्राधिकरण · गोपनीय परिचालन डेटा",mr:"नाशिक–त्र्यंबकेश्वर कुंभमेळा प्राधिकरण · गोपनीय परिचालन डेटा",gu:"નાશિક–ત્ર્યંબકેશ્વર કુંભ મેળા સત્તામંડળ · ગોપનીય ડેટા",ta:"நாசிக்–திரியம்பகேஸ்வர் கும்பமேளா ஆணையம் · ரகசிய தரவு"},
 ph_table_search:{en:"🔎 Search any field — name, case ID, location, description, district…",hi:"🔎 कोई भी फ़ील्ड खोजें — नाम, केस आईडी, स्थान, विवरण, जिला…",mr:"🔎 कोणतेही फील्ड शोधा — नाव, केस आयडी, ठिकाण, वर्णन, जिल्हा…",gu:"🔎 કોઈપણ ફીલ્ડ શોધો — નામ, કેસ આઈડી, સ્થળ, વર્ણન, જિલ્લો…",ta:"🔎 எந்த புலத்தையும் தேடு — பெயர், வழக்கு ஐடி, இடம், விவரம், மாவட்டம்…"},
 btn_clear:{en:"Clear",hi:"साफ़ करें",mr:"साफ करा",gu:"સાફ કરો",ta:"அழி"},
 btn_export:{en:"⬇ Export CSV",hi:"⬇ CSV निर्यात",mr:"⬇ CSV निर्यात",gu:"⬇ CSV નિકાસ",ta:"⬇ CSV ஏற்றுமதி"},
 lbl_map:{en:"🗺️ Map",hi:"🗺️ मानचित्र",mr:"🗺️ नकाशा",gu:"🗺️ નકશો",ta:"🗺️ வரைபடம்"},
 logout:{en:"Logout ✕",hi:"लॉगआउट ✕",mr:"लॉगआउट ✕",gu:"લૉગઆઉટ ✕",ta:"வெளியேறு ✕"},
 all:{en:"All",hi:"सभी",mr:"सर्व",gu:"બધા",ta:"அனைத்தும்"},
 of:{en:"of",hi:"में से",mr:"पैकी",gu:"માંથી",ta:"இல்"},
 cases_word:{en:"cases",hi:"केस",mr:"केस",gu:"કેસ",ta:"வழக்குகள்"},
 no_cases:{en:"No matching cases.",hi:"कोई मेल खाता केस नहीं।",mr:"जुळणारे केस नाहीत.",gu:"કોઈ મેળ ખાતો કેસ નથી.",ta:"பொருந்தும் வழக்குகள் இல்லை."},
 access_logged:{en:"Access is logged. Data shown per role-based access control (RBAC).",hi:"पहुँच लॉग की जाती है। डेटा भूमिका-आधारित अभिगम नियंत्रण (RBAC) अनुसार।",mr:"प्रवेश नोंदवला जातो. डेटा भूमिका-आधारित प्रवेश नियंत्रणानुसार (RBAC).",gu:"એક્સેસ લોગ થાય છે. ડેટા ભૂમિકા-આધારિત નિયંત્રણ (RBAC) મુજબ.",ta:"அணுகல் பதிவாகிறது. தரவு பணி அடிப்படையிலான கட்டுப்பாடு (RBAC) படி."},

 col_id:{en:"Case ID",hi:"केस आईडी",mr:"केस आयडी",gu:"કેસ આઈડી",ta:"வழக்கு ஐடி"},
 col_name:{en:"Name",hi:"नाम",mr:"नाव",gu:"નામ",ta:"பெயர்"},
 col_gender:{en:"Gender",hi:"लिंग",mr:"लिंग",gu:"જાતિ",ta:"பாலினம்"},
 col_age:{en:"Age band",hi:"आयु वर्ग",mr:"वयोगट",gu:"વય જૂથ",ta:"வயது வரம்பு"},
 col_status:{en:"Status",hi:"स्थिति",mr:"स्थिती",gu:"સ્થિતિ",ta:"நிலை"},
 col_loc:{en:"Last seen",hi:"अंतिम बार देखा",mr:"शेवटचे दिसले",gu:"છેલ્લે જોવાયું",ta:"கடைசியாக கண்டது"},
 col_zone:{en:"Zone",hi:"ज़ोन",mr:"झोन",gu:"ઝોન",ta:"மண்டலம்"},
 col_ts:{en:"Reported at",hi:"रिपोर्ट समय",mr:"तक्रार वेळ",gu:"રિપોર્ટ સમય",ta:"புகார் நேரம்"},
 col_lang:{en:"Language",hi:"भाषा",mr:"भाषा",gu:"ભાષા",ta:"மொழி"},
 col_phone:{en:"Reporter mobile",hi:"रिपोर्टर मोबाइल",mr:"तक्रारदार मोबाइल",gu:"રિપોર્ટર મોબાઇલ",ta:"புகார்தாரர் மொபைல்"},
 col_home:{en:"Home (district, state)",hi:"गृह (जिला, राज्य)",mr:"घर (जिल्हा, राज्य)",gu:"ઘર (જિલ્લો, રાજ્ય)",ta:"வீடு (மாவட்டம், மாநிலம்)"},
 col_desc:{en:"Description",hi:"विवरण",mr:"वर्णन",gu:"વર્ણન",ta:"விவரம்"},
 col_center:{en:"Reporting center",hi:"रिपोर्टिंग केंद्र",mr:"तक्रार केंद्र",gu:"રિપોર્ટિંગ કેન્દ્ર",ta:"புகார் மையம்"},
 col_resolution:{en:"Resolution (hrs)",hi:"समाधान (घंटे)",mr:"निराकरण (तास)",gu:"ઉકેલ (કલાક)",ta:"தீர்வு (மணி)"},
 col_remarks:{en:"Remarks",hi:"टिप्पणी",mr:"शेरा",gu:"ટિપ્પણી",ta:"குறிப்புகள்"},
 col_dup:{en:"Duplicate?",hi:"डुप्लिकेट?",mr:"डुप्लिकेट?",gu:"ડુપ્લિકેટ?",ta:"நகல்?"},

 /* ---- voice agent ---- */
 v_guide:{en:"Voice Guide",hi:"आवाज़ सहायक",mr:"आवाज सहायक",gu:"અવાજ સહાયક",ta:"குரல் வழிகாட்டி"},
 v_stop:{en:"Stop",hi:"रोकें",mr:"थांबा",gu:"રોકો",ta:"நிறுத்து"},
 v_ready:{en:"Press Voice Guide and answer each question.",hi:"आवाज़ सहायक दबाएँ और हर प्रश्न का उत्तर दें।",mr:"आवाज सहायक दाबा व प्रत्येक प्रश्नाचे उत्तर द्या.",gu:"અવાજ સહાયક દબાવો અને દરેક પ્રશ્નનો જવાબ આપો.",ta:"குரல் வழிகாட்டியை அழுத்தி ஒவ்வொரு கேள்விக்கும் பதிலளிக்கவும்."},
 v_listening:{en:"Listening…",hi:"सुन रहे हैं…",mr:"ऐकत आहे…",gu:"સાંભળી રહ્યું છે…",ta:"கேட்கிறது…"},
 v_speaking:{en:"Assistant speaking…",hi:"सहायक बोल रहा है…",mr:"सहायक बोलत आहे…",gu:"સહાયક બોલી રહ્યું છે…",ta:"உதவியாளர் பேசுகிறது…"},
 v_unsupported:{en:"Voice not supported here — use Chrome or Edge.",hi:"इस ब्राउज़र में आवाज़ समर्थित नहीं — Chrome या Edge का उपयोग करें।",mr:"या ब्राउझरमध्ये आवाज समर्थित नाही — Chrome किंवा Edge वापरा.",gu:"આ બ્રાઉઝરમાં અવાજ સપોર્ટેડ નથી — Chrome અથવા Edge વાપરો.",ta:"இந்த உலாவியில் குரல் ஆதரிக்கப்படவில்லை — Chrome அல்லது Edge பயன்படுத்தவும்."},
 v_greet:{en:"Welcome. I will ask a few questions to file the report. Please answer after each question.",hi:"नमस्ते। रिपोर्ट दर्ज करने के लिए मैं कुछ प्रश्न पूछूँगा। कृपया हर प्रश्न के बाद उत्तर दें।",mr:"नमस्कार. तक्रार नोंदवण्यासाठी मी काही प्रश्न विचारेन. कृपया प्रत्येक प्रश्नानंतर उत्तर द्या.",gu:"નમસ્તે. રિપોર્ટ નોંધાવવા હું થોડા પ્રશ્નો પૂછીશ. કૃપા કરી દરેક પ્રશ્ન પછી જવાબ આપો.",ta:"வணக்கம். புகாரை பதிவு செய்ய சில கேள்விகள் கேட்பேன். ஒவ்வொரு கேள்விக்கும் பின் பதிலளிக்கவும்."},
 v_ask_name:{en:"Please say the missing person's name.",hi:"कृपया गुमशुदा व्यक्ति का नाम बताइए।",mr:"कृपया हरवलेल्या व्यक्तीचे नाव सांगा.",gu:"કૃપા કરી ગુમ વ્યક્તિનું નામ બોલો.",ta:"காணாமல் போனவரின் பெயரைச் சொல்லுங்கள்."},
 v_ask_age:{en:"What is the person's age in years?",hi:"व्यक्ति की उम्र कितने वर्ष है?",mr:"व्यक्तीचे वय किती वर्षे आहे?",gu:"વ્યક્તિની ઉંમર કેટલા વર્ષ છે?",ta:"நபரின் வயது எத்தனை ஆண்டுகள்?"},
 v_ask_gender:{en:"Is the person male or female?",hi:"व्यक्ति पुरुष है या महिला?",mr:"व्यक्ती पुरुष आहे की महिला?",gu:"વ્યક્તિ પુરુષ છે કે સ્ત્રી?",ta:"நபர் ஆணா பெண்ணா?"},
 v_ask_loc:{en:"Where was the person last seen?",hi:"व्यक्ति आखिरी बार कहाँ देखा गया?",mr:"व्यक्ती शेवटची कुठे दिसली?",gu:"વ્યક્તિ છેલ્લે ક્યાં જોવાઈ?",ta:"நபர் கடைசியாக எங்கே காணப்பட்டார்?"},
 v_ask_desc:{en:"Please describe the person — clothes and any marks.",hi:"कृपया व्यक्ति का वर्णन करें — कपड़े और कोई निशान।",mr:"कृपया व्यक्तीचे वर्णन करा — कपडे व काही खुणा.",gu:"કૃપા કરી વ્યક્તિનું વર્ણન કરો — કપડાં અને કોઈ નિશાન.",ta:"நபரை விவரிக்கவும் — உடை மற்றும் அடையாளங்கள்."},
 v_done:{en:"Form filled. Please review the details and file the report.",hi:"फ़ॉर्म भर गया। कृपया विवरण जाँचें और रिपोर्ट दर्ज करें।",mr:"फॉर्म भरला. कृपया तपशील तपासा व तक्रार नोंदवा.",gu:"ફોર્મ ભરાઈ ગયું. કૃપા કરી વિગતો તપાસો અને રિપોર્ટ નોંધાવો.",ta:"படிவம் நிரப்பப்பட்டது. விவரங்களைச் சரிபார்த்து புகாரைப் பதிவு செய்யவும்."},
 v_heard:{en:"Heard",hi:"सुना",mr:"ऐकले",gu:"સાંભળ્યું",ta:"கேட்டது"},
 v_unclear:{en:"Sorry, I didn't catch that — please try again.",hi:"क्षमा करें, समझ नहीं आया — कृपया फिर बताएँ।",mr:"माफ करा, समजले नाही — कृपया पुन्हा सांगा.",gu:"માફ કરશો, સમજાયું નહીં — ફરી પ્રયત્ન કરો.",ta:"மன்னிக்கவும், புரியவில்லை — மீண்டும் முயற்சிக்கவும்."},
 v_ai:{en:"Describe freely (AI)",hi:"खुलकर बताएँ (AI)",mr:"मोकळेपणाने सांगा (AI)",gu:"મુક્તપણે કહો (AI)",ta:"சுதந்திரமாக சொல்லுங்கள் (AI)"},
 v_ai_ask:{en:"Describe the missing person in one sentence — name, age, what they wore, and where they were last seen.",hi:"गुमशुदा व्यक्ति का एक वाक्य में वर्णन करें — नाम, उम्र, कपड़े और आखिरी बार कहाँ देखा गया।",mr:"हरवलेल्या व्यक्तीचे एका वाक्यात वर्णन करा — नाव, वय, कपडे आणि शेवटचे कुठे दिसले.",gu:"ગુમ વ્યક્તિનું એક વાક્યમાં વર્ણન કરો — નામ, ઉંમર, કપડાં અને છેલ્લે ક્યાં જોવાયા.",ta:"காணாமல் போனவரை ஒரே வாக்கியத்தில் விவரிக்கவும் — பெயர், வயது, உடை, கடைசியாக கண்ட இடம்."},
 v_ai_working:{en:"Understanding…",hi:"समझ रहे हैं…",mr:"समजून घेत आहे…",gu:"સમજી રહ્યું છે…",ta:"புரிந்துகொள்கிறது…"},
 v_ai_done:{en:"Extracted the details — please review.",hi:"विवरण निकाल लिए — कृपया जाँचें।",mr:"तपशील काढले — कृपया तपासा.",gu:"વિગતો કાઢી — કૃપા કરી તપાસો.",ta:"விவரங்கள் பிரித்தெடுக்கப்பட்டன — சரிபார்க்கவும்."},
 v_ai_unavail:{en:"AI unavailable — filled what I could from speech.",hi:"AI उपलब्ध नहीं — भाषण से जो भर सका भर दिया।",mr:"AI उपलब्ध नाही — बोलण्यातून जे शक्य ते भरले.",gu:"AI ઉપલબ્ધ નથી — વાણીમાંથી શક્ય તેટલું ભર્યું.",ta:"AI இல்லை — பேச்சிலிருந்து முடிந்ததை நிரப்பினேன்."},
};

let LANG=localStorage.getItem("kp_lang")||"en";
function t(key){const e=STR[key];return e?(e[LANG]||e.en):key;}

function applyLang(){
  document.documentElement.lang=LANG;
  document.querySelectorAll("[data-i18n]").forEach(el=>{el.textContent=t(el.getAttribute("data-i18n"));});
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{el.setAttribute("placeholder",t(el.getAttribute("data-i18n-ph")));});
  document.querySelectorAll(".langSel").forEach(s=>{s.value=LANG;});
  document.dispatchEvent(new CustomEvent("kp:lang",{detail:LANG}));
}
function setLang(l){LANG=l;localStorage.setItem("kp_lang",l);applyLang();}

// build any language selectors marked with .langSel (option list injected here)
function initSelectors(){
  document.querySelectorAll(".langSel").forEach(sel=>{
    sel.innerHTML=LANGS.map(([c,n])=>`<option value="${c}">${n}</option>`).join("");
    sel.value=LANG;
    sel.addEventListener("change",e=>setLang(e.target.value));
  });
}

window.t=t; window.kpLang=()=>LANG; window.setLang=setLang;
document.addEventListener("DOMContentLoaded",()=>{initSelectors();applyLang();});
})();
