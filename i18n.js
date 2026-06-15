const STRINGS = {
  en: {
    title: "Himachal Flood & Rain Watch",
    subtitle: "Rainfall forecasts · Community flood map",
    searchLabel: "Search your village or block",
    searchPlaceholder: "e.g. Manali, Kullu, Almora…",
    gps: "Find My Village (GPS)",
    gpsLoading: "Locating…",
    loading: "Loading forecast…",
    loadingOverlay: "Loading villages…",
    updatingOverlay: "Updating overlay…",
    changeVillage: "Change village",
    today: "Today",
    minTemp: "Min °C",
    maxTemp: "Max °C",
    rainToday: "Expected rain today (mm)",
    rainBlocks: "Rain (3-hour blocks)",
    tempToday: "Temperature today",
    nextDays: "Next days",
    rainDay: "Expected rain (mm)",
    feedbackPrompt: "Is the forecast right for your field right now?",
    accurate: "Accurate",
    tooDry: "Too dry",
    tooDryHint: "(raining now)",
    tooWet: "Too wet",
    tooWetHint: "(sunny now)",
    thanks: "Thank you! Report recorded.",
    feedbackFail: "Could not send — try again when signal returns.",
    updated: "Updated",
    villagesLabel: "villages",
    extremeAlert:
      "Extreme rain alert — intense rainfall possible. Watch for landslides & flash floods.",
    heavyAlert: "Heavy rain — take precautions in fields & orchards.",
    noGps: "GPS not supported on this device.",
    gpsDenied: "Location permission denied. Search by village name instead.",
    searchFail: "Could not load village list. Check connection.",
    dbNotReady: "Forecasts are being prepared. Please try again shortly.",
    selectVillageHint: "Select a village above to see your forecast",

    // Topbar / nav
    tabRainfall: "🌧️ Rainfall",
    stateHP: "Himachal Pradesh",
    stateUK: "Uttarakhand",
    tabFloods: "📍 Floods",
    tabAbout: "ℹ️ About",
    navRainfall: "Rainfall",
    navFloods: "Floods",
    navAbout: "About",

    // Floating forecast panel
    villageForecast: "Village Forecast",
    searchHint: "↑ Search or tap a village on map",
    rainBlocksLbl: "🌧️ Rain (3hr blocks)",
    temperatureLbl: "🌡️ Temperature",
    sixDayOutlook: "📆 6-Day Outlook",
    rainMm: "Rain mm",

    // Trend labels (forecast condition)
    trendClear: "Clear",
    trendShowers: "Showers",
    trendRainy: "Rainy",
    trendVariable: "Variable",

    // Map / precipitation popup
    tomorrow: "Tmrw",
    precipitation: "Precipitation",
    temperature: "Temperature",
    rainLevel: "Rain level",
    viewForecast: "View forecast →",
    outsideCoverage: "Outside coverage area",
    noRainLabel: "No Rain",
    levelVeryLight: "Very light",
    levelLight: "Light Rainfall",
    levelModerate: "Moderate Rainfall",
    levelHeavy: "Heavy Rainfall",
    levelVeryHeavy: "Very Heavy Rainfall",
    levelExtreme: "Extremely Heavy Rainfall",

    // Floods panel
    floodReportsTitle: "Flood Reports",
    periodToday: "Today",
    period7d: "7 Days",
    periodAll: "All",
    reportFlood: "+ Report flood / landslide",
    closeForm: "✕ Close form",
    whatHappened: "What happened?",
    typeFlood: "Flood / river overflow",
    typeWaterlogging: "Waterlogging",
    typeLandslide: "Landslide / debris",
    typeRoadBlocked: "Road blocked",
    typeCloudburst: "Cloudburst",
    severityLabel: "Severity",
    severityLow: "Low",
    severityModerate: "Moderate",
    severityHigh: "High",
    villageOptional: "Village (optional)",
    noteOptional: "Note (optional)",
    notePlaceholder: "e.g. Bridge submerged",
    submit: "Submit",
    legendHigh: "High",
    legendModerate: "Moderate",
    legendLow: "Low",
    sending: "Sending…",
    reportSubmitted: "✓ Report added to map.",
    submitFailed: "Submit failed",
    reportsCount: "report(s)",
    noReportsPeriod: "No reports for this period.",
    reportedLocation: "Reported location",
    tlFlood: "Flood",
    tlWaterlogging: "Waterlogging",
    tlLandslide: "Landslide",
    tlRoadBlocked: "Road blocked",
    tlCloudburst: "Cloudburst",

    // Climatology context badges (vs. 2015-2025 monsoon climatology, IMERG)
    climBelowNormal: "Below normal for this area",
    climNormal: "Normal for this area",
    climAboveNormal: "Above normal for this area",
    climHeavy: "Heavy for this area (≥90th pct)",
    climVeryHeavy: "Very heavy for this area (≥95th pct)",
    climVeryExtreme: "Extreme for this area (≥99th pct)",
    climExtreme: "Record-class for this area (≥99.9th pct)",

    // About panel
    aboutTitle: "About HP Monsoon Portal",
    aboutIntro:
      "Research initiative by <strong>Centre for Climate Studies, IIT Bombay</strong> — real-time rainfall forecasts &amp; community flood reporting for Himachal Pradesh villages.",
    objectivesTitle: "🎯 Objectives",
    objective1: "Village-level real-time forecasts via Open-Meteo",
    objective2: "Community flood &amp; landslide reporting on satellite map",
    objective3: "Early warning for mountain communities during monsoon",
    objective4: "Climate resilience research for the Himalayan region",
    dataSourcesTitle: "🛰️ Data Sources",
    dataSourceWeather: "<strong>Weather:</strong> <a href=\"https://open-meteo.com\" target=\"_blank\">Open-Meteo</a> — real-time, free",
    dataSourceSatellite: "<strong>Satellite:</strong> Esri World Imagery",
    dataSourceTerrain: "<strong>Terrain:</strong> Esri World Shaded Relief",
    dataSourceMaps: "<strong>Maps:</strong> OpenStreetMap contributors",
    aboutDisclaimer: "⚠️ Forecasts from numerical models — always follow official IMD advisories.",
  },
  hi: {
    title: "हिमाचल बाढ़ और वर्षा देखरेख",
    subtitle: "वर्षा पूर्वानुमान · सामुदायिक बाढ़ मानचित्र",
    searchLabel: "अपना गाँव या ब्लॉक खोजें",
    searchPlaceholder: "जैसे मनाली, कुल्लू, अल्मोड़ा…",
    gps: "मेरा गाँव खोजें (GPS)",
    gpsLoading: "स्थान खोज रहे हैं…",
    loading: "पूर्वानुमान लोड हो रहा है…",
    loadingOverlay: "गाँव लोड हो रहे हैं…",
    updatingOverlay: "अपडेट हो रहा है…",
    changeVillage: "गाँव बदलें",
    today: "आज",
    minTemp: "न्यूनतम °C",
    maxTemp: "अधिकतम °C",
    rainToday: "आज अपेक्षित वर्षा (मिमी)",
    rainBlocks: "वर्षा (3 घंटे के ब्लॉक)",
    tempToday: "आज का तापमान",
    nextDays: "अगले दिन",
    rainDay: "अपेक्षित वर्षा (मिमी)",
    feedbackPrompt: "क्या यह पूर्वानुमान आपके खेत के लिए सही है?",
    accurate: "सही है",
    tooDry: "कम बारिश",
    tooDryHint: "(अभी बारिश हो रही)",
    tooWet: "ज़्यादा बारिश",
    tooWetHint: "(अभी धूप है)",
    thanks: "धन्यवाद! आपकी रिपोर्ट दर्ज हो गई।",
    feedbackFail: "भेज नहीं सके — सिग्नल मिलने पर फिर कोशिश करें।",
    updated: "अपडेट",
    villagesLabel: "गाँव",
    extremeAlert:
      "अत्यधिक वर्षा चेतावनी — तेज़ बारिश संभव। भूस्खलन और फ्लैश बाढ़ से सावधान रहें।",
    heavyAlert: "भारी वर्षा — खेत और बाग में सावधानी बरतें।",
    noGps: "इस डिवाइस पर GPS उपलब्ध नहीं है।",
    gpsDenied: "स्थान की अनुमति नहीं मिली। गाँव का नाम खोजें।",
    searchFail: "गाँव सूची लोड नहीं हुई। कनेक्शन जाँचें।",
    dbNotReady: "पूर्वानुमान तैयार हो रहे हैं। कृपया थोड़ी देर बाद कोशिश करें।",
    selectVillageHint: "पूर्वानुमान देखने के लिए ऊपर गाँव चुनें",

    // Topbar / nav
    tabRainfall: "🌧️ वर्षा",
    stateHP: "हिमाचल प्रदेश",
    stateUK: "उत्तराखंड",
    tabFloods: "📍 बाढ़",
    tabAbout: "ℹ️ जानकारी",
    navRainfall: "वर्षा",
    navFloods: "बाढ़",
    navAbout: "जानकारी",

    // Floating forecast panel
    villageForecast: "गाँव का पूर्वानुमान",
    searchHint: "↑ खोजें या मानचित्र पर गाँव पर टैप करें",
    rainBlocksLbl: "🌧️ वर्षा (3 घंटे के ब्लॉक)",
    temperatureLbl: "🌡️ तापमान",
    sixDayOutlook: "📆 6-दिन का पूर्वानुमान",
    rainMm: "वर्षा मिमी",

    // Trend labels (forecast condition)
    trendClear: "साफ़",
    trendShowers: "हल्की बारिश",
    trendRainy: "बारिश",
    trendVariable: "बदलता मौसम",

    // Map / precipitation popup
    tomorrow: "कल",
    precipitation: "वर्षा",
    temperature: "तापमान",
    rainLevel: "वर्षा स्तर",
    viewForecast: "पूर्वानुमान देखें →",
    outsideCoverage: "कवरेज क्षेत्र के बाहर",
    noRainLabel: "बारिश नहीं",
    levelVeryLight: "बहुत हल्की",
    levelLight: "हल्की वर्षा",
    levelModerate: "मध्यम वर्षा",
    levelHeavy: "भारी वर्षा",
    levelVeryHeavy: "बहुत भारी वर्षा",
    levelExtreme: "अत्यधिक भारी वर्षा",

    // Floods panel
    floodReportsTitle: "बाढ़ रिपोर्ट",
    periodToday: "आज",
    period7d: "7 दिन",
    periodAll: "सभी",
    reportFlood: "+ बाढ़ / भूस्खलन की रिपोर्ट करें",
    closeForm: "✕ फ़ॉर्म बंद करें",
    whatHappened: "क्या हुआ?",
    typeFlood: "बाढ़ / नदी का उफान",
    typeWaterlogging: "जलभराव",
    typeLandslide: "भूस्खलन / मलबा",
    typeRoadBlocked: "सड़क अवरुद्ध",
    typeCloudburst: "बादल फटना",
    severityLabel: "गंभीरता",
    severityLow: "कम",
    severityModerate: "मध्यम",
    severityHigh: "अधिक",
    villageOptional: "गाँव (वैकल्पिक)",
    noteOptional: "टिप्पणी (वैकल्पिक)",
    notePlaceholder: "जैसे पुल जलमग्न है",
    submit: "जमा करें",
    legendHigh: "अधिक",
    legendModerate: "मध्यम",
    legendLow: "कम",
    sending: "भेजा जा रहा है…",
    reportSubmitted: "✓ रिपोर्ट मानचित्र पर जोड़ी गई।",
    submitFailed: "जमा करने में विफल",
    reportsCount: "रिपोर्ट",
    noReportsPeriod: "इस अवधि के लिए कोई रिपोर्ट नहीं।",
    reportedLocation: "रिपोर्ट किया गया स्थान",
    tlFlood: "बाढ़",
    tlWaterlogging: "जलभराव",
    tlLandslide: "भूस्खलन",
    tlRoadBlocked: "सड़क अवरुद्ध",
    tlCloudburst: "बादल फटना",

    // Climatology context badges (vs. 2015-2025 monsoon climatology, IMERG)
    climBelowNormal: "इस क्षेत्र के लिए सामान्य से कम",
    climNormal: "इस क्षेत्र के लिए सामान्य",
    climAboveNormal: "इस क्षेत्र के लिए सामान्य से अधिक",
    climHeavy: "इस क्षेत्र के लिए भारी (≥90वां पर्सेंटाइल)",
    climVeryHeavy: "इस क्षेत्र के लिए बहुत भारी (≥95वां पर्सेंटाइल)",
    climVeryExtreme: "इस क्षेत्र के लिए अत्यधिक (≥99वां पर्सेंटाइल)",
    climExtreme: "इस क्षेत्र के लिए रिकॉर्ड-स्तरीय (≥99.9वां पर्सेंटाइल)",

    // About panel
    aboutTitle: "HP मानसून पोर्टल के बारे में",
    aboutIntro:
      "<strong>सेंटर फॉर क्लाइमेट स्टडीज़, IIT बॉम्बे</strong> की शोध पहल — हिमाचल प्रदेश के गाँवों के लिए वास्तविक समय वर्षा पूर्वानुमान और सामुदायिक बाढ़ रिपोर्टिंग।",
    objectivesTitle: "🎯 उद्देश्य",
    objective1: "Open-Meteo के माध्यम से गाँव-स्तर के वास्तविक समय पूर्वानुमान",
    objective2: "सैटेलाइट मानचित्र पर सामुदायिक बाढ़ और भूस्खलन रिपोर्टिंग",
    objective3: "मानसून के दौरान पहाड़ी समुदायों के लिए पूर्व चेतावनी",
    objective4: "हिमालयी क्षेत्र के लिए जलवायु लचीलापन शोध",
    dataSourcesTitle: "🛰️ डेटा स्रोत",
    dataSourceWeather: "<strong>मौसम:</strong> <a href=\"https://open-meteo.com\" target=\"_blank\">Open-Meteo</a> — वास्तविक समय, निःशुल्क",
    dataSourceSatellite: "<strong>सैटेलाइट:</strong> Esri World Imagery",
    dataSourceTerrain: "<strong>भू-भाग:</strong> Esri World Shaded Relief",
    dataSourceMaps: "<strong>मानचित्र:</strong> OpenStreetMap योगदानकर्ता",
    aboutDisclaimer: "⚠️ पूर्वानुमान संख्यात्मक मॉडल पर आधारित हैं — हमेशा आधिकारिक IMD सलाह का पालन करें।",
  },
};

let currentLang = localStorage.getItem("mfp_lang") || "en";

export function t(key) {
  return STRINGS[currentLang][key] || STRINGS.en[key] || key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!STRINGS[lang]) return;
  currentLang = lang;
  localStorage.setItem("mfp_lang", lang);
  document.documentElement.lang = lang === "hi" ? "hi" : "en";
}

export function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
}