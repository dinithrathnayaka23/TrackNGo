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
  "ID: ": "අංකය: ",
  "Ref: ": "යොමු: ",
  "Booking: ": "වෙන්කිරීම: ",
  "Journey Date: ": "ගමන් දිනය: ",
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

export function translateText(value: string, language: ProfileLanguage): string {
  if (language !== "si" || !value) return value;

  const trimmed = value.trim();
  const exact = SI_TRANSLATIONS[trimmed] ?? SI_TRANSLATIONS[value];
  if (exact) {
    return `${value.slice(0, value.indexOf(trimmed))}${exact}${value.slice(value.indexOf(trimmed) + trimmed.length)}`;
  }

  return value.replace(/\b[A-Za-z][A-Za-z'-]*\b/g, (word) => SI_WORDS[word.toLowerCase()] ?? word);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useSession();
  const [language, setLanguageState] = useState<ProfileLanguage>("en");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (active && (stored === "en" || stored === "si")) setLanguageState(stored);

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
