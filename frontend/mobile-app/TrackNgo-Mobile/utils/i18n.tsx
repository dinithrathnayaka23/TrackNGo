import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from "react-native";
import type { ProfileLanguage } from "../services/profileSettingsApi";
import { useSession } from "../store/sessionStore";

const LANGUAGE_STORAGE_KEY = "trackngo.language";

type LanguageContextValue = {
  language: ProfileLanguage;
  setLanguage: (language: ProfileLanguage) => Promise<void>;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const DEFAULT_LANGUAGE_CONTEXT: LanguageContextValue = {
  language: "en",
  setLanguage: async () => undefined,
  t: (value) => value,
};

const SI_TRANSLATIONS: Record<string, string> = {
  Home: "මුල් පිටුව",
  Chat: "කතාබස්",
  Profile: "පැතිකඩ",
  Settings: "සැකසුම්",
  AI: "AI",
  Assistant: "සහායකයා",
  Welcome: "සාදරයෙන් පිළිගනිමු",
  "Welcome Back": "නැවත සාදරයෙන් පිළිගනිමු",
  "Your Journey, Simplified": "ඔබගේ ගමන, වඩාත් පහසුයි",
  "Create Account": "ගිණුමක් සාදන්න",
  "Verify Your Number": "ඔබගේ අංකය තහවුරු කරන්න",
  "Email or Phone Number": "විද්‍යුත් තැපැල් ලිපිනය හෝ දුරකථන අංකය",
  Email: "විද්‍යුත් තැපෑල",
  "Email Address": "විද්‍යුත් තැපැල් ලිපිනය",
  "Where to?": "කොහේටද?",
  "Search by name...": "නමින් සොයන්න...",
  "Recording voice...": "හඬ පටිගත කරමින්...",
  "Type a message...": "පණිවිඩයක් ටයිප් කරන්න...",
  "Contact name": "සම්බන්ධතාවේ නම",
  Relationship: "සම්බන්ධතාවය",
  "e.g., Mother, Spouse, Friend": "උදා: මව, කලත්‍රයා, මිතුරා",
  "Pickup Location": "ගොඩවන ස්ථානය",
  "Drop-off Location": "බසින ස්ථානය",
  Password: "මුරපදය",
  "Remember me": "මාව මතක තබාගන්න",
  "Forgot Password?": "මුරපදය අමතකද?",
  "Log In": "ඇතුළු වන්න",
  Login: "ඇතුළු වන්න",
  Logout: "ඉවත් වන්න",
  "Sign Up": "ලියාපදිංචි වන්න",
  "Don’t have an account?": "ගිණුමක් නොමැතිද?",
  "Already have an account?": "දැනටමත් ගිණුමක් තිබේද?",
  "or continue with": "හෝ මෙය හරහා ඉදිරියට යන්න",
  Google: "Google",
  Facebook: "Facebook",
  "First Name": "මුල් නම",
  "Last Name": "අවසන් නම",
  "Mobile Number": "ජංගම දුරකථන අංකය",
  "Confirm Password": "මුරපදය තහවුරු කරන්න",
  "Terms & Conditions": "නියමයන් සහ කොන්දේසි",
  "Privacy Policy": "පෞද්ගලිකත්ව ප්‍රතිපත්තිය",
  Next: "ඊළඟ",
  Verify: "තහවුරු කරන්න",
  Cancel: "අවලංගු කරන්න",
  Save: "සුරකින්න",
  Done: "අවසන්",
  Retry: "නැවත උත්සාහ කරන්න",
  Search: "සොයන්න",
  Reset: "යළි සකසන්න",
  Apply: "යොදන්න",
  Continue: "ඉදිරියට යන්න",
  Submit: "යොමු කරන්න",
  Download: "බාගත කරන්න",
  Share: "බෙදාගන්න",
  Edit: "සංස්කරණය",
  Back: "ආපසු",
  "Go Back": "ආපසු යන්න",
  "Coming Soon": "ළඟදීම පැමිණේ",
  "Recent Bookings": "මෑත වෙන්කිරීම්",
  Upcoming: "ඉදිරියට ඇති",
  "My Bookings": "මගේ වෙන්කිරීම්",
  "Booking History": "වෙන්කිරීම් ඉතිහාසය",
  "Highway Bus": "අධිවේගී බස්",
  "Long Distance": "දිගු දුර",
  "Trip Booking": "ගමනක් වෙන්කරන්න",
  "Search Buses": "බස් සොයන්න",
  "Select Bus": "බසයක් තෝරන්න",
  "Select Seats": "ආසන තෝරන්න",
  "Bus Details": "බස් විස්තර",
  "Booking Confirmed!": "වෙන්කිරීම තහවුරු කරන ලදී!",
  Confirmation: "තහවුරු කිරීම",
  "View Ticket": "ප්‍රවේශපත්‍රය බලන්න",
  "Download Ticket (PDF)": "ප්‍රවේශපත්‍රය බාගත කරන්න (PDF)",
  Track: "නිරීක්ෂණය",
  Rate: "ඇගයීම",
  "Submit Complain": "පැමිණිල්ලක් යොමු කරන්න",
  "No buses found for this route.": "මෙම මාර්ගය සඳහා බස් හමු නොවීය.",
  "No buses available for this group size.": "මෙම කණ්ඩායම් ප්‍රමාණය සඳහා බස් නොමැත.",
  "Searching buses...": "බස් සොයමින්...",
  "Select Date": "දිනය තෝරන්න",
  Return: "ආපසු",
  Date: "දිනය",
  Departure: "පිටත්වීම",
  Passengers: "මගීන්",
  Passenger: "මගියා",
  Adult: "වැඩිහිටි",
  Children: "ළමුන්",
  "Bus Type": "බස් වර්ගය",
  "Departure Time": "පිටත්වන වේලාව",
  "Start Time": "ආරම්භක වේලාව",
  "End Time": "අවසන් වේලාව",
  "From": "සිට",
  "To": "දක්වා",
  "Journey Date": "ගමන් දිනය",
  "Total Amount": "මුළු මුදල",
  "Payment Method": "ගෙවීම් ක්‍රමය",
  "Card Payment": "කාඩ්පත් ගෙවීම",
  "Confirm & Pay": "තහවුරු කර ගෙවන්න",
  "Secure Checkout": "ආරක්ෂිත ගෙවීම",
  "Cancel Transaction": "ගනුදෙනුව අවලංගු කරන්න",
  "Payment Gateway": "ගෙවීම් දොරටුව",
  "Important Note": "වැදගත් සටහන",
  "Route Information": "මාර්ග තොරතුරු",
  "Vehicle & Driver": "වාහනය සහ රියදුරු",
  "View Layout": "සැලැස්ම බලන්න",
  "Book Seat": "ආසනය වෙන්කරන්න",
  Available: "ලබාගත හැකිය",
  Selected: "තෝරා ඇත",
  Booked: "වෙන්කර ඇත",
  Blocked: "අවහිර කර ඇත",
  "Selected Seats": "තෝරාගත් ආසන",
  "Total Price": "මුළු මිල",
  "Continue to Payment": "ගෙවීමට ඉදිරියට යන්න",
  "Cost Breakdown": "පිරිවැය විස්තර",
  "Base Fare": "මූලික ගාස්තුව",
  "Service Fee": "සේවා ගාස්තුව",
  "Promotion Discount": "ප්‍රවර්ධන වට්ටම",
  "Booking ID": "වෙන්කිරීමේ අංකය",
  "Ticket Reference": "ප්‍රවේශපත්‍ර යොමුව",
  "Seat Number": "ආසන අංකය",
  "Bus Number": "බස් අංකය",
  Status: "තත්ත්වය",
  "SCAN ME": "මා ස්කෑන් කරන්න",
  "Scan at boarding": "බසයට ගොඩවන විට ස්කෑන් කරන්න",
  "Show this QR code to the driver": "මෙම QR කේතය රියදුරුට පෙන්වන්න",
  Paid: "ගෙවා ඇත",
  PAID: "ගෙවා ඇත",
  "My Complaints": "මගේ පැමිණිලි",
  "No complaints submitted yet.": "තවමත් පැමිණිලි යොමු කර නැත.",
  "Submit a Complaint": "පැමිණිල්ලක් යොමු කරන්න",
  "Complaint Type": "පැමිණිලි වර්ගය",
  "Priority Level": "ප්‍රමුඛතා මට්ටම",
  Description: "විස්තරය",
  "Supporting Evidence": "සහායක සාක්ෂි",
  Notifications: "දැනුම්දීම්",
  "No notifications": "දැනුම්දීම් නොමැත",
  "Emergency Contacts": "හදිසි සම්බන්ධතා",
  SOS: "හදිසි සහාය",
  "Call Admin": "පරිපාලක අමතන්න",
  "Return to Home": "මුල් පිටුවට ආපසු යන්න",
  "TrackNGo AI": "TrackNGo කෘත්‍රිම බුද්ධි සහායකයා",
  "Ask about buses, seats, ETA, refunds...": "බස්, ආසන, පැමිණීමේ වේලාව, මුදල් ආපසු ගෙවීම් ගැන විමසන්න...",
  "Loading upcoming bookings...": "ඉදිරියට ඇති වෙන්කිරීම් පූරණය වෙමින්...",
  "No upcoming bookings found.": "ඉදිරියට ඇති වෙන්කිරීම් හමු නොවීය.",
  Trip: "ගමන",
  Booking: "වෙන්කිරීම",
  Negotiate: "සාකච්ඡා කරන්න",
  "Track Live": "සජීවීව නිරීක්ෂණය",
  "Good Morning": "සුභ උදෑසනක්",
  "Good Afternoon": "සුභ දහවලක්",
  "Good Evening": "සුභ සන්ධ්‍යාවක්",
  "Good Night": "සුභ රාත්‍රියක්",
  "English": "ඉංග්‍රීසි",
  Sinhala: "සිංහල",
  Tamil: "දෙමළ",
  "ID: ": "අංකය: ",
  "Ref: ": "යොමු: ",
  "Booking: ": "වෙන්කිරීම: ",
  "Journey Date: ": "ගමන් දිනය: ",
};

const TA_TRANSLATIONS: Record<string, string> = {
  Home: "முகப்பு",
  Chat: "அரட்டை",
  Profile: "சுயவிவரம்",
  Settings: "அமைப்புகள்",
  AI: "AI",
  Assistant: "உதவியாளர்",
  Welcome: "வரவேற்கிறோம்",
  "Welcome Back": "மீண்டும் வரவேற்கிறோம்",
  "Your Journey, Simplified": "உங்கள் பயணம், எளிதாக்கப்பட்டது",
  "Create Account": "கணக்கை உருவாக்கவும்",
  "Verify Your Number": "உங்கள் எண்ணை சரிபார்க்கவும்",
  "Email or Phone Number": "மின்னஞ்சல் அல்லது தொலைபேசி எண்",
  Email: "மின்னஞ்சல்",
  "Email Address": "மின்னஞ்சல் முகவரி",
  "Where to?": "எங்கே செல்ல வேண்டும்?",
  "Search by name...": "பெயரால் தேடவும்...",
  "Recording voice...": "குரல் பதிவு செய்யப்படுகிறது...",
  "Type a message...": "செய்தியை தட்டச்சு செய்யவும்...",
  "Contact name": "தொடர்பு பெயர்",
  Relationship: "உறவு",
  "e.g., Mother, Spouse, Friend": "எ.கா., தாய், வாழ்க்கைத் துணை, நண்பர்",
  "Pickup Location": "ஏற்றும் இடம்",
  "Drop-off Location": "இறங்கும் இடம்",
  Password: "கடவுச்சொல்",
  "Remember me": "என்னை நினைவில் கொள்",
  "Forgot Password?": "கடவுச்சொல் மறந்துவிட்டதா?",
  "Log In": "உள்நுழைக",
  Login: "உள்நுழைக",
  Logout: "வெளியேறு",
  "Sign Up": "பதிவு செய்யவும்",
  "Don’t have an account?": "கணக்கு இல்லையா?",
  "Already have an account?": "ஏற்கனவே கணக்கு உள்ளதா?",
  "or continue with": "அல்லது இதன் மூலம் தொடரவும்",
  Google: "Google",
  Facebook: "Facebook",
  "First Name": "முதல் பெயர்",
  "Last Name": "கடைசி பெயர்",
  "Mobile Number": "மொபைல் எண்",
  "Confirm Password": "கடவுச்சொல்லை உறுதிப்படுத்தவும்",
  "Terms & Conditions": "விதிமுறைகள் மற்றும் நிபந்தனைகள்",
  "Privacy Policy": "தனியுரிமைக் கொள்கை",
  Next: "அடுத்து",
  Verify: "சரிபார்க்கவும்",
  Cancel: "ரத்து செய்",
  Save: "சேமி",
  Done: "முடிந்தது",
  Retry: "மீண்டும் முயற்சிக்கவும்",
  Search: "தேடு",
  Reset: "மீட்டமை",
  Apply: "பயன்படுத்து",
  Continue: "தொடரவும்",
  Submit: "சமர்ப்பிக்கவும்",
  Download: "பதிவிறக்கு",
  Share: "பகிர்",
  Edit: "திருத்து",
  Back: "பின்",
  "Go Back": "பின் செல்",
  "Coming Soon": "விரைவில் வருகிறது",
  "Recent Bookings": "சமீபத்திய முன்பதிவுகள்",
  Upcoming: "வரவிருக்கும்",
  "My Bookings": "எனது முன்பதிவுகள்",
  "Booking History": "முன்பதிவு வரலாறு",
  "Highway Bus": "நெடுஞ்சாலை பேருந்து",
  "Long Distance": "நீண்ட தூரம்",
  "Trip Booking": "பயண முன்பதிவு",
  "Search Buses": "பேருந்துகளைத் தேடு",
  "Select Bus": "பேருந்தைத் தேர்ந்தெடு",
  "Select Seats": "இருக்கைகளைத் தேர்ந்தெடு",
  "Bus Details": "பேருந்து விவரங்கள்",
  "Booking Confirmed!": "முன்பதிவு உறுதி செய்யப்பட்டது!",
  Confirmation: "உறுதிப்படுத்தல்",
  "View Ticket": "டிக்கெட்டைக் காண்க",
  "Download Ticket (PDF)": "டிக்கெட்டைப் பதிவிறக்கு (PDF)",
  Track: "கண்காணி",
  Rate: "மதிப்பீடு",
  "Submit Complain": "புகார் சமர்ப்பிக்கவும்",
  "No buses found for this route.": "இந்த வழித்தடத்திற்கு பேருந்துகள் இல்லை.",
  "No buses available for this group size.": "இந்த குழு அளவிற்கு பேருந்துகள் இல்லை.",
  "Searching buses...": "பேருந்துகளைத் தேடுகிறது...",
  "Select Date": "தேதியைத் தேர்ந்தெடு",
  Return: "திரும்பு",
  Date: "தேதி",
  Departure: "புறப்பாடு",
  Passengers: "பயணிகள்",
  Passenger: "பயணி",
  Adult: "வயது வந்தோர்",
  Children: "குழந்தைகள்",
  "Bus Type": "பேருந்து வகை",
  "Departure Time": "புறப்படும் நேரம்",
  "Start Time": "தொடங்கும் நேரம்",
  "End Time": "முடியும் நேரம்",
  "From": "இருந்து",
  "To": "வரை",
  "Journey Date": "பயண தேதி",
  "Total Amount": "மொத்த தொகை",
  "Payment Method": "கட்டண முறை",
  "Card Payment": "அட்டை கட்டணம்",
  "Confirm & Pay": "உறுதி செய்து செலுத்து",
  "Secure Checkout": "பாதுகாப்பான செக்அவுட்",
  "Cancel Transaction": "பரிவர்த்தனையை ரத்து செய்",
  "Payment Gateway": "கட்டண நுழைவாயில்",
  "Important Note": "முக்கிய குறிப்பு",
  "Route Information": "வழித்தட தகவல்",
  "Vehicle & Driver": "வாகனம் மற்றும் ஓட்டுநர்",
  "View Layout": "அமைப்பைக் காண்க",
  "Book Seat": "இருக்கையை முன்பதிவு செய்",
  Available: "கிடைக்கிறது",
  Selected: "தேர்ந்தெடுக்கப்பட்டது",
  Booked: "முன்பதிவு செய்யப்பட்டது",
  Blocked: "தடுக்கப்பட்டது",
  "Selected Seats": "தேர்ந்தெடுக்கப்பட்ட இருக்கைகள்",
  "Total Price": "மொத்த விலை",
  "Continue to Payment": "கட்டணத்திற்குத் தொடரவும்",
  "Cost Breakdown": "செலவு விவரம்",
  "Base Fare": "அடிப்படை கட்டணம்",
  "Service Fee": "சேவை கட்டணம்",
  "Promotion Discount": "விளம்பர தள்ளுபடி",
  "Booking ID": "முன்பதிவு ஐடி",
  "Ticket Reference": "டிக்கெட் குறிப்பு",
  "Seat Number": "இருக்கை எண்",
  "Bus Number": "பேருந்து எண்",
  Status: "நிலை",
  "SCAN ME": "என்னை ஸ்கேன் செய்யவும்",
  "Scan at boarding": "ஏறும் போது ஸ்கேன் செய்யவும்",
  "Show this QR code to the driver": "இந்த QR குறியீட்டை ஓட்டுநரிடம் காட்டவும்",
  Paid: "செலுத்தப்பட்டது",
  PAID: "செலுத்தப்பட்டது",
  "My Complaints": "எனது புகார்கள்",
  "No complaints submitted yet.": "இதுவரை புகார்கள் எதுவும் இல்லை.",
  "Submit a Complaint": "புகார் சமர்ப்பிக்கவும்",
  "Complaint Type": "புகார் வகை",
  "Priority Level": "முன்னுரிமை நிலை",
  Description: "விளக்கம்",
  "Supporting Evidence": "ஆதரவு சான்று",
  Notifications: "அறிவிப்புகள்",
  "No notifications": "அறிவிப்புகள் இல்லை",
  "Emergency Contacts": "அவசர தொடர்புகள்",
  SOS: "SOS",
  "Call Admin": "நிர்வாகியை அழைக்கவும்",
  "Return to Home": "முகப்புக்குத் திரும்பு",
  "TrackNGo AI": "TrackNGo AI உதவியாளர்",
  "Ask about buses, seats, ETA, refunds...": "பேருந்துகள், இருக்கைகள், வருகை நேரம், பணத் திரும்பப்பெறுதல் பற்றி கேளுங்கள்...",
  "Loading upcoming bookings...": "வரவிருக்கும் முன்பதிவுகள் ஏற்றப்படுகிறது...",
  "No upcoming bookings found.": "வரவிருக்கும் முன்பதிவுகள் இல்லை.",
  Trip: "பயணம்",
  Booking: "முன்பதிவு",
  Negotiate: "பேச்சுவார்த்தை",
  "Track Live": "நேரலையில் கண்காணி",
  "Good Morning": "காலை வணக்கம்",
  "Good Afternoon": "மதிய வணக்கம்",
  "Good Evening": "மாலை வணக்கம்",
  "Good Night": "இனிய இரவு",
  "English": "ஆங்கிலம்",
  Sinhala: "சிங்களம்",
  Tamil: "தமிழ்",
  "ID: ": "ஐடி: ",
  "Ref: ": "குறிப்பு: ",
  "Booking: ": "முன்பதிவு: ",
  "Journey Date: ": "பயண தேதி: ",
};

const SI_WORDS: Record<string, string> = {
  home: "මුල් පිටුව",
  profile: "පැතිකඩ",
  settings: "සැකසුම්",
  booking: "වෙන්කිරීම",
  bookings: "වෙන්කිරීම්",
  bus: "බස්",
  buses: "බස්",
  seat: "ආසනය",
  seats: "ආසන",
  payment: "ගෙවීම",
  date: "දිනය",
  time: "වේලාව",
  amount: "මුදල",
  total: "මුළු",
  name: "නම",
  phone: "දුරකථනය",
  number: "අංකය",
  location: "ස්ථානය",
  details: "විස්තර",
  loading: "පූරණය වෙමින්",
  error: "දෝෂයකි",
  message: "පණිවිඩය",
  send: "යවන්න",
  call: "අමතන්න",
  yes: "ඔව්",
  no: "නැත",
};

const TA_WORDS: Record<string, string> = {
  home: "முகப்பு",
  profile: "சுயவிவரம்",
  settings: "அமைப்புகள்",
  booking: "முன்பதிவு",
  bookings: "முன்பதிவுகள்",
  bus: "பேருந்து",
  buses: "பேருந்துகள்",
  seat: "இருக்கை",
  seats: "இருக்கைகள்",
  payment: "கட்டணம்",
  date: "தேதி",
  time: "நேரம்",
  amount: "தொகை",
  total: "மொத்தம்",
  name: "பெயர்",
  phone: "தொலைபேசி",
  number: "எண்",
  location: "இடம்",
  details: "விவரங்கள்",
  loading: "ஏற்றுகிறது",
  error: "பிழை",
  message: "செய்தி",
  send: "அனுப்பு",
  call: "அழை",
  yes: "ஆம்",
  no: "இல்லை",
};

const TRANSLATION_TABLES: Partial<Record<ProfileLanguage, { exact: Record<string, string>; words: Record<string, string> }>> = {
  si: { exact: SI_TRANSLATIONS, words: SI_WORDS },
  ta: { exact: TA_TRANSLATIONS, words: TA_WORDS },
};

export function translateText(value: string, language: ProfileLanguage): string {
  const table = TRANSLATION_TABLES[language];
  if (!table || !value) return value;

  const trimmed = value.trim();
  const exact = table.exact[trimmed] ?? table.exact[value];
  if (exact) {
    return `${value.slice(0, value.indexOf(trimmed))}${exact}${value.slice(value.indexOf(trimmed) + trimmed.length)}`;
  }

  return value.replace(/\b[A-Za-z][A-Za-z'-]*\b/g, (word) => table.words[word.toLowerCase()] ?? word);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useSession();
  const [language, setLanguageState] = useState<ProfileLanguage>("en");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (active && (stored === "en" || stored === "si" || stored === "ta")) setLanguageState(stored);

      if (!currentUser) return;
      try {
        const { getUserSettings } = await import("../services/profileSettingsApi");
        const settings = await getUserSettings(currentUser.userId);
        if (!active) return;
        setLanguageState(settings.language);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, settings.language);
      } catch {
        // Keep the locally cached language when the settings endpoint is unavailable.
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const setLanguage = useCallback(async (nextLanguage: ProfileLanguage) => {
    setLanguageState(nextLanguage);
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (text) => translateText(text, language),
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext) ?? DEFAULT_LANGUAGE_CONTEXT;
}

export function LocalizedText({ children, ...props }: TextProps) {
  const { language } = useLanguage();
  return (
    <NativeText {...props}>
      {React.Children.map(children, (child) => typeof child === "string" ? translateText(child, language) : child)}
    </NativeText>
  );
}

export function LocalizedTextInput({ placeholder, ...props }: TextInputProps) {
  const { t } = useLanguage();
  return <NativeTextInput {...props} placeholder={placeholder ? t(placeholder) : placeholder} />;
}
