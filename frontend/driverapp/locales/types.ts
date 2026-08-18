export interface Translations {
  common: {
    ok: string;
    cancel: string;
    retry: string;
    notAvailable: string;
  };
  tabs: {
    home: string;
    allocations: string;
    earnings: string;
    chat: string;
    settings: string;
  };
  dashboard: {
    greeting: string;
    monthlyEarnings: string;
    growthVsYesterday: string;
    currentTrip: string;
    live: string;
    notLive: string;
    mapView: string;
    routeStops: string;
    stopsMapped: string;
    stopsNotLoaded: string;
    eta: string;
    passengerCount: string;
    noPassengerData: string;
    details: string;
    navigate: string;
    quickStats: string;
    tripsDone: string;
    totalTrips: string;
    noCurrentRoute: string;
    noRouteAvailableTitle: string;
    noRouteAvailableMessage: string;
    liveSharing: string;
    liveSharingWithGps: string;
    weakGpsSignal: string;
    weakGpsSignalWithPercent: string;
    sharingOff: string;
    locationDenied: string;
    trackingRetrying: string;
    liveRoute: string;
    assignedRoute: string;
    etaHoursMinutes: string;
    etaMinutes: string;
  };
  settings: {
    headerTitle: string;
    loadingProfile: string;
    idPrefix: string;
    profileCompletion: string;
    tabLicense: string;
    tabBackground: string;
    tabProfile: string;
    professionalDetails: string;
    fullName: string;
    emailAddress: string;
    changePassword: string;
    changePasswordAlertMessage: string;
    mobileNumber: string;
    licenseNumber: string;
    licenseExpiry: string;
    expired: string;
    valid: string;
    joinedDate: string;
    experience: string;
    experienceYears: string;
    bankDetails: string;
    bankAccountNumber: string;
    bankName: string;
    currentAssignment: string;
    busInformation: string;
    noActiveAssignment: string;
    route: string;
    noRouteAssigned: string;
    routeIdPrefix: string;
    feedback: string;
    ratingsAndComplaints: string;
    settingsTitle: string;
    language: string;
    chooseLanguage: string;
    privacy: string;
    shareLocation: string;
    requiredForTracking: string;
    twoFactorAuth: string;
    supportAndLegal: string;
    helpAndSupport: string;
    helpAndSupportLoading: string;
    privacyPolicy: string;
    privacyPolicyLoading: string;
    termsAndConditions: string;
    termsLoading: string;
    aboutUs: string;
    aboutUsLoading: string;
    preferences: string;
    lightDarkMode: string;
    notifications: string;
    systemNotifications: string;
    pushNotifications: string;
    smsAlerts: string;
    emailUpdates: string;
    bookingUpdates: string;
    logOut: string;
    logoutConfirmTitle: string;
    logoutConfirmMessage: string;
    permissionRequiredTitle: string;
    permissionRequiredMessage: string;
    loginRequiredTitle: string;
    loginRequiredMessage: string;
    uploadFailedTitle: string;
    uploadFailedMessage: string;
  };
  chat: {
    title: string;
    searchPlaceholder: string;
    noConversations: string;
    failedToLoadConversations: string;
    customerSupport: string;
    userFallback: string;
    conversationFallback: string;
    participantPassenger: string;
    participantDriver: string;
    participantCorporate: string;
    photo: string;
    voiceMessage: string;
    sharedLocation: string;
    noMessagesYet: string;
    messageDeleted: string;
    today: string;
    yesterday: string;
  };
  earnings: {
    title: string;
    greeting: string;
    driverFallback: string;
    yourMonthlyEarnings: string;
    percentageChange: string;
    updatedJustNow: string;
    weeklyEarnings: string;
    last7Days: string;
    last7DaysBreakdown: string;
    viewAll: string;
    netEarnings: string;
    viewReceipt: string;
    exportMonthlyReport: string;
    tripReceipt: string;
    route: string;
    date: string;
    time: string;
    close: string;
    totalAmount: string;
    day: string;
    amount: string;
    driverEarningsReport: string;
    monthlySummaryStatement: string;
    driverName: string;
    totalEarnings: string;
    weeklyBreakdown: string;
    netTotal: string;
    generatedBy: string;
    mon: string;
    tue: string;
    wed: string;
    thu: string;
    fri: string;
    sat: string;
    sun: string;
  };
  allocations: {
    loadingSeatLayout: string;
    noDataAvailable: string;
    noBusAssignment: string;
    failedToLoadSeatLayout: string;
    networkErrorMessage: string;
    departure: string;
    journeyDate: string;
    passengers: string;
    boardedCount: string;
    boarded: string;
    booked: string;
    available: string;
    blocked: string;
    driver: string;
    passengerFallback: string;
    noSeatsAvailable: string;
    seatNumber: string;
    pickUp: string;
    dropOff: string;
    specialRequests: string;
    call: string;
    message: string;
    alreadyBoarded: string;
    markAsBoarded: string;
    error: string;
    pleaseSelectBookedSeat: string;
    passengerOptions: string;
    chooseAnAction: string;
    scanQrCode: string;
    seatNotBooked: string;
    success: string;
    passengerMarkedBoarded: string;
    failedToMarkBoarded: string;
    blockedSeatTitle: string;
    blockedSeatMessage: string;
  };
}

/**
 * Listed explicitly (rather than derived via a recursive mapped/template-literal type over
 * Translations) because TS's recursive template-literal inference blows up to "Type
 * instantiation is excessively deep and possibly infinite" once a nested interface this size
 * is involved.
 */
export const TRANSLATION_KEYS = [
  "common.ok",
  "common.cancel",
  "common.retry",
  "common.notAvailable",
  "tabs.home",
  "tabs.allocations",
  "tabs.earnings",
  "tabs.chat",
  "tabs.settings",
  "dashboard.greeting",
  "dashboard.monthlyEarnings",
  "dashboard.growthVsYesterday",
  "dashboard.currentTrip",
  "dashboard.live",
  "dashboard.notLive",
  "dashboard.mapView",
  "dashboard.routeStops",
  "dashboard.stopsMapped",
  "dashboard.stopsNotLoaded",
  "dashboard.eta",
  "dashboard.passengerCount",
  "dashboard.noPassengerData",
  "dashboard.details",
  "dashboard.navigate",
  "dashboard.quickStats",
  "dashboard.tripsDone",
  "dashboard.totalTrips",
  "dashboard.noCurrentRoute",
  "dashboard.noRouteAvailableTitle",
  "dashboard.noRouteAvailableMessage",
  "dashboard.liveSharing",
  "dashboard.liveSharingWithGps",
  "dashboard.weakGpsSignal",
  "dashboard.weakGpsSignalWithPercent",
  "dashboard.sharingOff",
  "dashboard.locationDenied",
  "dashboard.trackingRetrying",
  "dashboard.liveRoute",
  "dashboard.assignedRoute",
  "dashboard.etaHoursMinutes",
  "dashboard.etaMinutes",
  "settings.headerTitle",
  "settings.loadingProfile",
  "settings.idPrefix",
  "settings.profileCompletion",
  "settings.tabLicense",
  "settings.tabBackground",
  "settings.tabProfile",
  "settings.professionalDetails",
  "settings.fullName",
  "settings.emailAddress",
  "settings.changePassword",
  "settings.changePasswordAlertMessage",
  "settings.mobileNumber",
  "settings.licenseNumber",
  "settings.licenseExpiry",
  "settings.expired",
  "settings.valid",
  "settings.joinedDate",
  "settings.experience",
  "settings.experienceYears",
  "settings.bankDetails",
  "settings.bankAccountNumber",
  "settings.bankName",
  "settings.currentAssignment",
  "settings.busInformation",
  "settings.noActiveAssignment",
  "settings.route",
  "settings.noRouteAssigned",
  "settings.routeIdPrefix",
  "settings.feedback",
  "settings.ratingsAndComplaints",
  "settings.settingsTitle",
  "settings.language",
  "settings.chooseLanguage",
  "settings.privacy",
  "settings.shareLocation",
  "settings.requiredForTracking",
  "settings.twoFactorAuth",
  "settings.supportAndLegal",
  "settings.helpAndSupport",
  "settings.helpAndSupportLoading",
  "settings.privacyPolicy",
  "settings.privacyPolicyLoading",
  "settings.termsAndConditions",
  "settings.termsLoading",
  "settings.aboutUs",
  "settings.aboutUsLoading",
  "settings.preferences",
  "settings.lightDarkMode",
  "settings.notifications",
  "settings.systemNotifications",
  "settings.pushNotifications",
  "settings.smsAlerts",
  "settings.emailUpdates",
  "settings.bookingUpdates",
  "settings.logOut",
  "settings.logoutConfirmTitle",
  "settings.logoutConfirmMessage",
  "settings.permissionRequiredTitle",
  "settings.permissionRequiredMessage",
  "settings.loginRequiredTitle",
  "settings.loginRequiredMessage",
  "settings.uploadFailedTitle",
  "settings.uploadFailedMessage",
  "chat.title",
  "chat.searchPlaceholder",
  "chat.noConversations",
  "chat.failedToLoadConversations",
  "chat.customerSupport",
  "chat.userFallback",
  "chat.conversationFallback",
  "chat.participantPassenger",
  "chat.participantDriver",
  "chat.participantCorporate",
  "chat.photo",
  "chat.voiceMessage",
  "chat.sharedLocation",
  "chat.noMessagesYet",
  "chat.messageDeleted",
  "chat.today",
  "chat.yesterday",
  "earnings.title",
  "earnings.greeting",
  "earnings.driverFallback",
  "earnings.yourMonthlyEarnings",
  "earnings.percentageChange",
  "earnings.updatedJustNow",
  "earnings.weeklyEarnings",
  "earnings.last7Days",
  "earnings.last7DaysBreakdown",
  "earnings.viewAll",
  "earnings.netEarnings",
  "earnings.viewReceipt",
  "earnings.exportMonthlyReport",
  "earnings.tripReceipt",
  "earnings.route",
  "earnings.date",
  "earnings.time",
  "earnings.close",
  "earnings.totalAmount",
  "earnings.day",
  "earnings.amount",
  "earnings.driverEarningsReport",
  "earnings.monthlySummaryStatement",
  "earnings.driverName",
  "earnings.totalEarnings",
  "earnings.weeklyBreakdown",
  "earnings.netTotal",
  "earnings.generatedBy",
  "earnings.mon",
  "earnings.tue",
  "earnings.wed",
  "earnings.thu",
  "earnings.fri",
  "earnings.sat",
  "earnings.sun",
  "allocations.loadingSeatLayout",
  "allocations.noDataAvailable",
  "allocations.noBusAssignment",
  "allocations.failedToLoadSeatLayout",
  "allocations.networkErrorMessage",
  "allocations.departure",
  "allocations.journeyDate",
  "allocations.passengers",
  "allocations.boardedCount",
  "allocations.boarded",
  "allocations.booked",
  "allocations.available",
  "allocations.blocked",
  "allocations.driver",
  "allocations.passengerFallback",
  "allocations.noSeatsAvailable",
  "allocations.seatNumber",
  "allocations.pickUp",
  "allocations.dropOff",
  "allocations.specialRequests",
  "allocations.call",
  "allocations.message",
  "allocations.alreadyBoarded",
  "allocations.markAsBoarded",
  "allocations.error",
  "allocations.pleaseSelectBookedSeat",
  "allocations.passengerOptions",
  "allocations.chooseAnAction",
  "allocations.scanQrCode",
  "allocations.seatNotBooked",
  "allocations.success",
  "allocations.passengerMarkedBoarded",
  "allocations.failedToMarkBoarded",
  "allocations.blockedSeatTitle",
  "allocations.blockedSeatMessage",
] as const;

export type TranslationKey = (typeof TRANSLATION_KEYS)[number];
