import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { io } from "socket.io-client";
import "./App.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { 
  Send, Mic, Bell, Pill, User, Bot, Trash2, 
  Loader2, PlusCircle, History, ArrowLeft, Calendar, Package,
  Paperclip, Edit2, Search, X, Save, Phone, UserCircle, Clock, Map,
  ShoppingCart, Menu, LogOut, Home, Camera, Lock, Eye, EyeOff, Sun, Moon, BarChart3, TrendingUp, Users, Volume2, VolumeX, ShieldCheck, FileText
} from "lucide-react";
import { DoctorDashboard } from "./components/DoctorDashboard";
import { RevenueAnalytics } from "./components/RevenueAnalytics";
import { BookAppointment } from "./components/BookAppointment";
import { DoctorRegistration } from "./components/DoctorRegistration";
import { SystemManagerDoctorApprovals } from "./components/SystemManagerDoctorApprovals";
import { SystemManagerRequestHistory } from "./components/SystemManagerRequestHistory";
import { DeliveryBoyDashboard } from "./components/DeliveryBoyDashboard";
import LoginPage from "./pages/LoginPage";
import { API_BASE, SOCKET_URL } from "./config/api";
import { clearAuthToken, initializeAuthToken, setAuthToken } from "./config/auth";
const DEFAULT_PROJECT_LOCATION = {
  lat: 20.7935,
  lng: 76.7005,
  label: "Latitude: 20.7935, Longitude: 76.7005",
};

const I18N = {
  en: {
    app_name: "Pharma AI",
    choose_role: "Choose how you want to proceed",
    continue: "Continue",
    user_chatbot: "User (chatbot)",
    admin_role: "Admin (inventory)",
    login_as: "Login as {role}",
    register_as: "Register as {role}",
    login: "Login",
    register: "Register",
    name: "Name",
    phone_number: "Phone number",
    age: "Age",
    shop_id: "Shop ID",
    password: "Password",
    name_required: "Name is required",
    shop_id_required: "Shop ID is required",
    phone_required: "Phone number is required",
    password_required: "Password is required",
    processing: "Processing...",
    already_have_account: "Already have an account? Login",
    dont_have_account: "Don't have an account? Register",
    dashboard: "Dashboard",
    products: "Products",
    chat: "Chat",
    history: "History",
    light: "Light",
    dark: "Dark",
    profile: "Profile",
    welcome_back: "Welcome back, {name}",
    pharmacist: "Pharmacist",
    dashboard_subtitle: "Your personal pharmacy dashboard",
    quick_actions: "Quick Actions",
    quick_actions_subtitle: "Start here to explore products, chat, or review orders.",
    browse_products: "Browse Products",
    chat_assistant: "Chat Assistant",
    order_history: "Order History",
    marketplace: "Marketplace",
    marketplace_subtitle: "Browse the latest medicines and products in stock.",
    total_products: "Total products",
    your_orders: "Your orders",
    featured_picks: "Featured picks",
    featured_subtitle: "Click any item to order instantly via chat.",
    no_products: "No products loaded yet.",
    order_now: "Order now",
    shop_products: "Shop Products",
    shop_subtitle: "Browse and order medicines instantly",
    all_products: "All products",
    all_products_subtitle: "Search and order from our catalog.",
    search_products: "Search products...",
    no_results: "No products found.",
    no_description: "No description available.",
    chat_title: "Chat Assistant",
    chat_subtitle: "Ask me anything about medicines and orders",
    clear_chat: "Clear Chat",
    refill_alerts: "Refill Alerts",
    report_analysis: "Report Analysis",
    uploaded_report: "Uploaded Medical Report",
    report_chat_title: "Report Q&A Assistant",
    report_chat_subtitle: "Upload report, ask questions, and get report-grounded answers",
    report_upload_first: "Please upload a medical report first.",
    report_question_placeholder: "Ask a question about this report...",
    report_language_label: "Explanation Language",
    order_paracetamol: "Order Paracetamol",
    order_paracetamol_command: "Order 2 strips of Paracetamol",
    input_placeholder: "How can I help you today?",
    listening_placeholder: "Listening... speak now",
    uploaded_doc: "Uploaded Prescription Document",
    connection_error: "Connection Error: Make sure your backend is running at localhost:8000.",
    consulting_db: "Consulting pharmaceutical database...",
    no_history: "No order history found for this patient.",
    profile_title: "My Profile",
    language: "Language",
    close: "Close",
    save: "Save",
    logout: "Logout",
    alerts_title: "Medication Refill Alerts",
    alerts_empty: "All your prescriptions are up to date.",
    alerts_needed_by: "Needed by",
    welcome_message:
      "### Welcome to Agentic Pharmacy Assistant\nI am your AI pharmacist. I can help you with:\n1. **Ordering Medicines** (e.g., 'Order 2 Paracetamol')\n2. **Refill Alerts** (Click the button below)\n3. **Drug Information**\n\nHow can I help you today?",
    history_title: "Order History",
    history_subtitle: "Your past orders and purchases",
    price_label: "Price",
    qty_label: "Qty",
    dosage_label: "Dosage",
    reminder_title: "Refill Reminder",
    need_reminder: "Need Reminder?",
    completed: "Completed",
    unknown_product: "Unknown Product",
    unknown_date: "Unknown Date",
    not_available: "N/A",
    reminder_subtitle: "When do you want us to remind you to take or re-order this medicine via WhatsApp?",
    days: "Days",
    hours: "Hours",
    confirm_reminder: "Confirm Reminder",
    scheduling: "Scheduling...",
    select_time_error: "Please select at least 1 hour or 1 day.",
    cancel_order: "Cancel Order",
    cancelling: "Cancelling...",
    status_label: "Status",
    status_cancelled: "Cancelled",
    status_active: "Active",
    admin_inventory: "Inventory Management",
    admin_orders: "Customer Order History",
    admin_analysis: "Order Analysis Dashboard",
    admin_user_orders: "User Orders",
    admin_total_orders: "Total Orders",
    admin_top_selling: "Top 5 Selling Products"
    ,admin_tab_analysis: "Order Analysis"
    ,admin_tab_inventory: "Inventory"
    ,admin_tab_orders: "User Orders"
    ,admin_import_excel: "Import Excel"
    ,admin_uploading: "Uploading..."
    ,admin_search_products: "Search products..."
    ,admin_all_placed_orders: "All Placed Orders"
    ,admin_search_orders: "Search by customer, phone, or medicine..."
    ,admin_total_revenue: "Total Revenue"
    ,admin_avg_order_value: "Avg Order Value"
    ,admin_items_sold: "Items Sold"
    ,admin_product_name: "Product Name"
    ,admin_units_sold: "Units Sold"
    ,admin_revenue: "Revenue"
    ,admin_sales_trend: "7-Day Sales Trend"
    ,admin_no_data: "No data available"
    ,admin_edit_product: "Edit Product"
    ,admin_stock_level: "Stock Level"
    ,admin_price_label: "Price"
    ,admin_prescription_required: "Prescription Required"
    ,admin_save_changes: "Save Changes"
    ,admin_saving: "Saving..."
    ,admin_upload_failed: "Upload failed"
    ,nearby_shops: "Nearby Shops"
    ,nearby_title: "Nearby Medical Shops"
    ,nearby_subtitle: "Find pharmacies near you and get the shortest route"
    ,use_location: "Use My Location"
    ,manual_location: "Manual location"
    ,search_place: "Search place"
    ,search_place_placeholder: "Search area (e.g., Andheri West, Mumbai)"
    ,searching: "Searching..."
    ,pick_location: "Pick this location"
    ,latitude: "Latitude"
    ,longitude: "Longitude"
    ,find_shops: "Find Shops"
    ,closest_route: "Show Shortest Route"
    ,distance: "Distance"
    ,no_shops: "No shops found nearby."
    ,location_error: "Unable to get location. Please enter manually."
    ,route_error: "Unable to fetch route."
    ,nearby_loading: "Finding shops near you..."
  },
  hi: {
    app_name: "फार्मा एआई",
    choose_role: "कृपया अपना विकल्प चुनें",
    continue: "जारी रखें",
    user_chatbot: "उपयोगकर्ता (चैटबॉट)",
    admin_role: "एडमिन (इन्वेंटरी)",
    login_as: "{role} के रूप में लॉगिन",
    register_as: "{role} के रूप में रजिस्टर",
    login: "लॉगिन",
    register: "रजिस्टर",
    name: "नाम",
    phone_number: "फ़ोन नंबर",
    age: "उम्र",
    shop_id: "शॉप आईडी",
    password: "पासवर्ड",
    name_required: "नाम आवश्यक है",
    shop_id_required: "शॉप आईडी आवश्यक है",
    phone_required: "फ़ोन नंबर आवश्यक है",
    password_required: "पासवर्ड आवश्यक है",
    processing: "प्रोसेस हो रहा है...",
    already_have_account: "पहले से अकाउंट है? लॉगिन करें",
    dont_have_account: "अकाउंट नहीं है? रजिस्टर करें",
    dashboard: "डैशबोर्ड",
    products: "उत्पाद",
    chat: "चैट",
    history: "इतिहास",
    light: "लाइट",
    dark: "डार्क",
    profile: "प्रोफ़ाइल",
    welcome_back: "वापसी पर स्वागत है, {name}",
    pharmacist: "फार्मासिस्ट",
    dashboard_subtitle: "आपका व्यक्तिगत फार्मेसी डैशबोर्ड",
    quick_actions: "त्वरित कार्य",
    quick_actions_subtitle: "यहाँ से उत्पाद देखें, चैट करें, या ऑर्डर देखें।",
    browse_products: "उत्पाद देखें",
    chat_assistant: "चैट असिस्टेंट",
    order_history: "ऑर्डर इतिहास",
    marketplace: "मार्केटप्लेस",
    marketplace_subtitle: "नवीनतम दवाएं और उत्पाद देखें।",
    total_products: "कुल उत्पाद",
    your_orders: "आपके ऑर्डर",
    featured_picks: "चुने हुए उत्पाद",
    featured_subtitle: "किसी भी आइटम पर क्लिक करके ऑर्डर करें।",
    no_products: "अभी कोई उत्पाद लोड नहीं हुए।",
    order_now: "अभी ऑर्डर करें",
    shop_products: "उत्पाद खरीदें",
    shop_subtitle: "दवाएं ब्राउझ करें और ऑर्डर करें",
    all_products: "सभी उत्पाद",
    all_products_subtitle: "कैटलॉग में खोजें और ऑर्डर करें।",
    search_products: "उत्पाद खोजें...",
    no_results: "कोई उत्पाद नहीं मिला।",
    no_description: "विवरण उपलब्ध नहीं है।",
    chat_title: "चैट असिस्टेंट",
    chat_subtitle: "दवाओं और ऑर्डर के बारे में पूछें",
    clear_chat: "चैट साफ करें",
    refill_alerts: "रीफिल अलर्ट",
    report_analysis: "रिपोर्ट विश्लेषण",
    uploaded_report: "अपलोड की गई मेडिकल रिपोर्ट",
    report_chat_title: "रिपोर्ट प्रश्नोत्तर सहायक",
    report_chat_subtitle: "रिपोर्ट अपलोड करें, प्रश्न पूछें, और रिपोर्ट-आधारित उत्तर पाएं",
    report_upload_first: "कृपया पहले मेडिकल रिपोर्ट अपलोड करें।",
    report_question_placeholder: "इस रिपोर्ट के बारे में प्रश्न पूछें...",
    report_language_label: "व्याख्या की भाषा",
    order_paracetamol: "पैरासिटामोल ऑर्डर करें",
    order_paracetamol_command: "पैरासिटामोल की 2 स्ट्रिप ऑर्डर करें",
    input_placeholder: "मैं आपकी कैसे मदद कर सकता हूँ?",
    listening_placeholder: "सुन रहा हूँ... बोलें",
    uploaded_doc: "अपलोड किया गया प्रिस्क्रिप्शन दस्तावेज़",
    connection_error: "कनेक्शन त्रुटी: कृपया बैकएंड चल रहा है या नहीं जांचें।",
    consulting_db: "फ़ार्मेसी डेटाबेस से जानकारी ली जा रही है...",
    no_history: "इस मरीज के लिए कोई ऑर्डर इतिहास नहीं मिला।",
    profile_title: "मेरी प्रोफ़ाइल",
    language: "भाषा",
    close: "बंद करें",
    save: "सहेजें",
    logout: "लॉगआउट",
    alerts_title: "दवा रीफिल अलर्ट",
    alerts_empty: "आपके सभी प्रिस्क्रिप्शन अपडेट हैं।",
    alerts_needed_by: "जरूरत की तारीख",
    welcome_message:
      "### एजेंटिक फार्मेसी असिस्टेंट में आपका स्वागत है\nमैं आपका एआई फार्मासिस्ट हूँ। मैं मदद कर सकता हूँ:\n1. **दवाएं ऑर्डर करना** (जैसे, 'Order 2 Paracetamol')\n2. **रीफिल अलर्ट** (नीचे बटन दबाएं)\n3. **दवा जानकारी**\n\nमैं आपकी कैसे मदद कर सकता हूँ?",
    history_title: "ऑर्डर इतिहास",
    history_subtitle: "आपके पिछले ऑर्डर और खरीदारी",
    price_label: "कीमत",
    qty_label: "मात्रा",
    dosage_label: "डोज़",
    reminder_title: "रीफिल रिमाइंडर",
    need_reminder: "रिमाइंडर चाहिए?",
    completed: "पूर्ण",
    unknown_product: "अज्ञात उत्पाद",
    unknown_date: "अज्ञात तारीख",
    not_available: "उपलब्ध नहीं",
    reminder_subtitle: "कब याद दिलाएं कि दवा लें या दोबारा ऑर्डर करें?",
    days: "दिन",
    hours: "घंटे",
    confirm_reminder: "रिमाइंडर कन्फर्म करें",
    scheduling: "शेड्यूल हो रहा है...",
    select_time_error: "कृपया कम से कम 1 घंटा या 1 दिन चुनें।",
    admin_inventory: "इन्वेंटरी प्रबंधन",
    admin_orders: "ग्राहक ऑर्डर इतिहास",
    admin_analysis: "ऑर्डर विश्लेषण डैशबोर्ड",
    admin_user_orders: "उपयोगकर्ता ऑर्डर",
    admin_total_orders: "कुल ऑर्डर",
    admin_top_selling: "शीर्ष 5 उत्पाद"
    ,admin_tab_analysis: "ऑर्डर विश्लेषण"
    ,admin_tab_inventory: "इन्वेंटरी"
    ,admin_tab_orders: "उपयोगकर्ता ऑर्डर"
    ,admin_import_excel: "एक्सेल आयात करें"
    ,admin_uploading: "अपलोड हो रहा है..."
    ,admin_search_products: "उत्पाद खोजें..."
    ,admin_all_placed_orders: "सभी ऑर्डर"
    ,admin_search_orders: "ग्राहक, फ़ोन या दवा से खोजें..."
    ,admin_total_revenue: "कुल राजस्व"
    ,admin_avg_order_value: "औसत ऑर्डर मूल्य"
    ,admin_items_sold: "बिके हुए आइटम"
    ,admin_product_name: "उत्पाद नाम"
    ,admin_units_sold: "बेची गई इकाइयाँ"
    ,admin_revenue: "राजस्व"
    ,admin_sales_trend: "7-दिन बिक्री ट्रेंड"
    ,admin_no_data: "कोई डेटा उपलब्ध नहीं"
    ,admin_edit_product: "उत्पाद संपादित करें"
    ,admin_stock_level: "स्टॉक स्तर"
    ,admin_price_label: "कीमत"
    ,admin_prescription_required: "प्रिस्क्रिप्शन आवश्यक"
    ,admin_save_changes: "परिवर्तन सहेजें"
    ,admin_saving: "सहेज रहा है..."
    ,admin_upload_failed: "अपलोड विफल"
    ,nearby_shops: "नज़दीकी मेडिकल शॉप्स"
    ,nearby_title: "नज़दीकी मेडिकल शॉप्स"
    ,nearby_subtitle: "Find pharmacies near you and get the shortest route"
    ,use_location: "Use My Location"
    ,manual_location: "Manual location"
    ,search_place: "स्थान खोजें"
    ,search_place_placeholder: "क्षेत्र खोजें (जैसे, अंधेरी वेस्ट, मुंबई)"
    ,searching: "खोजा जा रहा है..."
    ,pick_location: "यह लोकेशन चुनें"
    ,latitude: "Latitude"
    ,longitude: "Longitude"
    ,find_shops: "Find Shops"
    ,closest_route: "Show Shortest Route"
    ,distance: "Distance"
    ,no_shops: "No shops found nearby."
    ,location_error: "Unable to get location. Please enter manually."
    ,route_error: "Unable to fetch route."
    ,nearby_loading: "Finding shops near you..."
  },
  mr: {
    app_name: "फार्मा एआय",
    choose_role: "कृपया तुमचा पर्याय निवडा",
    continue: "पुढे चला",
    user_chatbot: "वापरकर्ता (चॅटबॉट)",
    admin_role: "ऍडमिन (इन्व्हेंटरी)",
    login_as: "{role} म्हणून लॉगिन",
    register_as: "{role} म्हणून नोंदणी",
    login: "लॉगिन",
    register: "नोंदणी",
    name: "नाव",
    phone_number: "फोन नंबर",
    age: "वय",
    shop_id: "शॉप आयडी",
    password: "पासवर्ड",
    name_required: "नाव आवश्यक आहे",
    shop_id_required: "शॉप आयडी आवश्यक आहे",
    phone_required: "फोन नंबर आवश्यक आहे",
    password_required: "पासवर्ड आवश्यक आहे",
    processing: "प्रक्रिया चालू आहे...",
    already_have_account: "आधीच अकाउंट आहे? लॉगिन करा",
    dont_have_account: "अकाउंट नाही? नोंदणी करा",
    dashboard: "डॅशबोर्ड",
    products: "उत्पादने",
    chat: "चॅट",
    history: "इतिहास",
    light: "लाइट",
    dark: "डार्क",
    profile: "प्रोफाइल",
    welcome_back: "परत स्वागत आहे, {name}",
    pharmacist: "फार्मासिस्ट",
    dashboard_subtitle: "तुमचा वैयक्तिक फार्मसी डॅशबोर्ड",
    quick_actions: "जलद कृती",
    quick_actions_subtitle: "इथून उत्पादने पहा, चॅट करा, किंवा ऑर्डर पाहा.",
    browse_products: "उत्पादने पहा",
    chat_assistant: "चॅट असिस्टंट",
    order_history: "ऑर्डर इतिहास",
    marketplace: "मार्केटप्लेस",
    marketplace_subtitle: "नवीन औषधे आणि उत्पादने पाहा.",
    total_products: "एकूण उत्पादने",
    your_orders: "तुमचे ऑर्डर",
    featured_picks: "निवडक उत्पादने",
    featured_subtitle: "कुठल्याही आयटमवर क्लिक करून ऑर्डर करा.",
    no_products: "आत्तासाठी उत्पादने उपलब्ध नाहीत.",
    order_now: "आता ऑर्डर करा",
    shop_products: "उत्पादने खरेदी करा",
    shop_subtitle: "औषधे ब्राउझ करा आणि ऑर्डर करा",
    all_products: "सर्व उत्पादने",
    all_products_subtitle: "कॅटलॉगमध्ये शोधा आणि ऑर्डर करा.",
    search_products: "उत्पादने शोधा...",
    no_results: "कोणतेही उत्पादने सापडली नाहीत.",
    no_description: "वर्णन उपलब्ध नाही.",
    chat_title: "चॅट असिस्टंट",
    chat_subtitle: "औषधे आणि ऑर्डरबद्दल विचारा",
    clear_chat: "चॅट साफ करा",
    refill_alerts: "रीफिल अलर्ट",
    report_analysis: "रिपोर्ट विश्लेषण",
    uploaded_report: "अपलोड केलेला वैद्यकीय अहवाल",
    report_chat_title: "रिपोर्ट प्रश्नोत्तर सहाय्यक",
    report_chat_subtitle: "रिपोर्ट अपलोड करा, प्रश्न विचारा, आणि रिपोर्ट-आधारित उत्तरे मिळवा",
    report_upload_first: "कृपया आधी वैद्यकीय रिपोर्ट अपलोड करा.",
    report_question_placeholder: "या रिपोर्टबद्दल प्रश्न विचारा...",
    report_language_label: "स्पष्टीकरणाची भाषा",
    order_paracetamol: "पॅरासिटामॉल ऑर्डर करा",
    order_paracetamol_command: "पॅरासिटामॉलच्या 2 स्ट्रिप्स ऑर्डर करा",
    input_placeholder: "मी तुमची कशी मदत करू?",
    listening_placeholder: "ऐकत आहे... बोला",
    uploaded_doc: "अपलोड केलेला प्रिस्क्रिप्शन दस्तऐवज",
    connection_error: "कनेक्शन त्रुटी: बॅकएंड चालू आहे का तपासा.",
    consulting_db: "फार्मसी डेटाबेस पाहत आहोत...",
    no_history: "या रुग्णासाठी ऑर्डर इतिहास सापडला नाही.",
    profile_title: "माझी प्रोफाइल",
    language: "भाषा",
    close: "बंद करा",
    save: "जतन करा",
    logout: "लॉगआउट",
    alerts_title: "औषध रीफिल अलर्ट",
    alerts_empty: "तुमचे सर्व प्रिस्क्रिप्शन अपडेट आहेत.",
    alerts_needed_by: "आवश्यक तारीख",
    welcome_message:
      "### एजेंटिक फार्मसी असिस्टंटमध्ये स्वागत आहे\nमी तुमचा एआय फार्मासिस्ट आहे. मी मदत करू शकतो:\n1. **औषधे ऑर्डर करणे** (उदा., 'Order 2 Paracetamol')\n2. **रीफिल अलर्ट** (खालील बटण दाबा)\n3. **औषध माहिती**\n\nमी तुमची कशी मदत करू?",
    history_title: "ऑर्डर इतिहास",
    history_subtitle: "तुमचे मागील ऑर्डर आणि खरेदी",
    price_label: "किंमत",
    qty_label: "प्रमाण",
    dosage_label: "डोस",
    reminder_title: "रीफिल रिमाइंडर",
    need_reminder: "रिमाइंडर हवा?",
    completed: "पूर्ण",
    unknown_product: "अज्ञात उत्पादन",
    unknown_date: "अज्ञात तारीख",
    not_available: "उपलब्ध नाही",
    reminder_subtitle: "कधी आठवण करून द्यायची की औषध घ्या किंवा पुन्हा ऑर्डर करा?",
    days: "दिन",
    hours: "तास",
    confirm_reminder: "रिमाइंडर पुष्टी करा",
    scheduling: "शेड्यूल होत आहे...",
    select_time_error: "कृपया किमान 1 तास किंवा 1 दिन निवडा.",
    admin_inventory: "इन्व्हेंटरी व्यवस्थापन",
    admin_orders: "ग्राहक ऑर्डर इतिहास",
    admin_analysis: "ऑर्डर विश्लेषण डॅशबोर्ड",
    admin_user_orders: "वापरकर्ता ऑर्डर",
    admin_total_orders: "एकूण ऑर्डर",
    admin_top_selling: "टॉप 5 उत्पादने"
    ,admin_tab_analysis: "ऑर्डर विश्लेषण"
    ,admin_tab_inventory: "इन्व्हेंटरी"
    ,admin_tab_orders: "वापरकर्ता ऑर्डर"
    ,admin_import_excel: "एक्सेल आयात करा"
    ,admin_uploading: "अपलोड होत आहे..."
    ,admin_search_products: "उत्पादने शोधा..."
    ,admin_all_placed_orders: "सर्व ऑर्डर्स"
    ,admin_search_orders: "ग्राहक, फोन किंवा औषधाने शोधा..."
    ,admin_total_revenue: "कुल महसूल"
    ,admin_avg_order_value: "औसत ऑर्डर मूल्य"
    ,admin_items_sold: "विकलेली आयटम्स"
    ,admin_product_name: "उत्पादनाचे नाव"
    ,admin_units_sold: "विकलेली युनिट्स"
    ,admin_revenue: "महसूल"
    ,admin_sales_trend: "7-दिन बिक्री ट्रेंड"
    ,admin_no_data: "कोई डेटा उपलब्ध नाही"
    ,admin_edit_product: "उत्पादन संपादित करा"
    ,admin_stock_level: "स्टॉक पातळी"
    ,admin_price_label: "किंमत"
    ,admin_prescription_required: "प्रिस्क्रिप्शन आवश्यक"
    ,admin_save_changes: "बदल जतन करा"
    ,admin_saving: "जतन होत आहे..."
    ,admin_upload_failed: "अपलोड अयशस्वी"
    ,nearby_shops: "जवळची मेडिकल दुकाने"
    ,nearby_title: "जवळची मेडिकल दुकाने"
    ,nearby_subtitle: "Find pharmacies near you and get the shortest route"
    ,use_location: "Use My Location"
    ,manual_location: "Manual location"
    ,search_place: "ठिकाण शोधा"
    ,search_place_placeholder: "परिसर शोधा (उदा., अंधेरी वेस्ट, मुंबई)"
    ,searching: "शोध सुरू आहे..."
    ,pick_location: "हे ठिकाण निवडा"
    ,latitude: "अक्षांश"
    ,longitude: "रेखांश"
    ,find_shops: "Find Shops"
    ,closest_route: "Show Shortest Route"
    ,distance: "अंतर"
    ,no_shops: "No shops found nearby."
    ,location_error: "Unable to get location. Please enter manually."
    ,route_error: "Unable to fetch route."
    ,nearby_loading: "Finding shops near you..."
  }
};

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ===== LOGIN FORM COMPONENT (separate to avoid hook ordering issues) =====
function LoginForm({ onLogin, onBookAppointment }) {
  const [loginRole, setLoginRole] = useState("user");
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loginData, setLoginData] = useState({
    phone: "",
    email: "",
    password: "",
    age: "",
    name: "",
    shopId: "",
    managerId: "sysmanager",
  });

  const isCustomer = loginRole === "user";
  const isPharmacist = loginRole === "admin";
  const isDoctor = loginRole === "doctor";
  const isSystemManager = loginRole === "system_manager";
  const lang = "en";
  const t = (key, vars = {}) => {
    const str = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    return Object.keys(vars).reduce((acc, k) => acc.replaceAll(`{${k}}`, vars[k]), str);
  };

  const clearMessages = () => {
    setError("");
    setInfo("");
  };

  const switchRole = (nextRole) => {
    setLoginRole(nextRole);
    setShowRegister(false);
    clearMessages();
  };

  const handleSubmit = async () => {
    setError("");
    setInfo("");

    if (!loginData.password.trim()) {
      setError(t("password_required"));
      return;
    }

    if (isDoctor) {
      if (showRegister) {
        if (!loginData.name.trim()) {
          setError(t("name_required"));
          return;
        }
        if (!loginData.email.trim()) {
          setError("Email is required");
          return;
        }
        if (!loginData.phone.trim()) {
          setError(t("phone_required"));
          return;
        }

        setLoading(true);
        try {
          const res = await axios.post(`${API_BASE}/doctor/register`, {
            doctor_id: loginData.email.split("@")[0],
            name: loginData.name,
            email: loginData.email,
            phone: loginData.phone,
            gender: "Other",
            specialty: "General Physician",
            experience_years: 0,
            qualification: "MBBS",
            password: loginData.password,
            preferred_language: "en"
          });
          if (res.data.success) {
            setInfo(`Doctor registration submitted. Login ID: ${res.data.login_id || loginData.email}`);
            setShowRegister(false);
          } else {
            setError(res.data.message || "Doctor registration failed");
          }
        } catch (err) {
          setError(err.response?.data?.detail || "Registration error: " + err.message);
        } finally {
          setLoading(false);
        }
      } else {
        if (!loginData.email.trim()) {
          setError("Email is required");
          return;
        }

        setLoading(true);
        try {
          const res = await axios.post(`${API_BASE}/doctor/login`, {
            doctor_id: null,
            email: loginData.email,
            password: loginData.password
          });
          if (res.data.success) {
            if (res.data.access_token) {
              setAuthToken(res.data.access_token);
            }
            onLogin("doctor", res.data.doctor, res.data.doctor.id);
          } else {
            setError(res.data.message || "Doctor login failed");
          }
        } catch (err) {
          setError(err.response?.data?.detail || "Login error: " + err.message);
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    if (isSystemManager) {
      setLoading(true);
      try {
        const res = await axios.post(`${API_BASE}/auth/system-manager/login`, {
          manager_id: loginData.managerId,
          password: loginData.password,
        });
        if (res.data.success) {
          if (res.data.access_token) {
            setAuthToken(res.data.access_token);
          }
          onLogin(
            "system_manager",
            {
              ...res.data.user,
              manager_id: loginData.managerId,
            },
            res.data.session_id
          );
        } else {
          setError(res.data.message || "System Manager login failed");
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Login error: " + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (showRegister) {
      if (!loginData.name.trim()) {
        setError(t("name_required"));
        return;
      }
      if (isPharmacist && !loginData.shopId.trim()) {
        setError(t("shop_id_required"));
        return;
      }
      if (isCustomer && !loginData.phone.trim()) {
        setError(t("phone_required"));
        return;
      }

      setLoading(true);
      try {
        if (isPharmacist) {
          const res = await axios.post(`${API_BASE}/auth/pharmacist/request`, {
            name: loginData.name,
            shop_id: loginData.shopId,
            password: loginData.password,
          });
          if (res.data.success) {
            setInfo("Pharmacist request submitted. Wait for System Manager approval.");
            setShowRegister(false);
          } else {
            setError(res.data.message || "Request failed");
          }
        } else {
          const res = await axios.post(`${API_BASE}/auth/register`, {
            name: loginData.name,
            phone: loginData.phone,
            shop_id: null,
            password: loginData.password,
            age: loginData.age ? parseInt(loginData.age, 10) : null,
          });
          if (res.data.success) {
            if (res.data.access_token) {
              setAuthToken(res.data.access_token);
            }
            onLogin("user", res.data.user, res.data.session_id);
          } else {
            setError(res.data.message || "Registration failed");
          }
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Registration error: " + err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isPharmacist && !loginData.shopId.trim()) {
      setError(t("shop_id_required"));
      return;
    }
    if (isCustomer && !loginData.phone.trim()) {
      setError(t("phone_required"));
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        phone: isCustomer ? loginData.phone : null,
        shop_id: isPharmacist ? loginData.shopId : null,
        password: loginData.password,
      });

      if (res.data.success) {
        if (res.data.access_token) {
          setAuthToken(res.data.access_token);
        }
        onLogin(loginRole, res.data.user, res.data.session_id);
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Login error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(rgba(239, 246, 255, 0.72), rgba(239, 246, 255, 0.72)), url('/medical-portal-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-5xl grid lg:grid-cols-[1fr_540px] gap-8 items-center relative z-10">
        <div className="hidden lg:block">
          <div className="rounded-3xl bg-white/55 backdrop-blur border border-white/70 p-8 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                <Pill size={30} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">PHARMA PORTAL</h1>
                <p className="text-slate-600 text-lg">Trusted medication workflow</p>
              </div>
            </div>
            <p className="text-slate-700 text-lg leading-relaxed">
              Manage customer orders, pharmacist operations, and secure approvals with one unified medical platform.
            </p>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur border border-white rounded-3xl shadow-2xl p-8 sm:p-10">
          <div className="text-center mb-6">
            <h2 className="text-4xl font-extrabold text-blue-900">Welcome Back</h2>
            <p className="text-slate-600 mt-2 text-lg">Login to continue</p>
          </div>

          <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => switchRole("user")}
              className={`rounded-lg py-2.5 text-base font-bold transition ${isCustomer ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}
            >
              Customer
            </button>
            <button
              onClick={() => switchRole("admin")}
              className={`rounded-lg py-2.5 text-base font-bold transition ${isPharmacist ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}
            >
              Pharmacist
            </button>
            <button
              onClick={() => switchRole("doctor")}
              className={`rounded-lg py-2.5 text-base font-bold transition ${isDoctor ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}
            >
              Doctor
            </button>
            <button
              onClick={() => switchRole("system_manager")}
              className={`rounded-lg py-2.5 text-base font-bold transition ${isSystemManager ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"}`}
            >
              Manager
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
              {info}
            </div>
          )}

          <div className="space-y-3">
            {showRegister && !isSystemManager && (
              <input
                type="text"
                placeholder={t("name")}
                value={loginData.name}
                onChange={(e) => setLoginData({ ...loginData, name: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {isCustomer && (
              <>
                <input
                  type="text"
                  placeholder={t("phone_number")}
                  value={loginData.phone}
                  onChange={(e) => setLoginData({ ...loginData, phone: e.target.value })}
                  className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showRegister && (
                  <input
                    type="number"
                    placeholder={t("age")}
                    value={loginData.age}
                    onChange={(e) => setLoginData({ ...loginData, age: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </>
            )}

            {isPharmacist && (
              <input
                type="text"
                placeholder={t("shop_id")}
                value={loginData.shopId}
                onChange={(e) => setLoginData({ ...loginData, shopId: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            {isDoctor && (
              <>
                <input
                  type="email"
                  placeholder="Doctor Email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  placeholder={t("phone_number")}
                  value={loginData.phone}
                  onChange={(e) => setLoginData({ ...loginData, phone: e.target.value })}
                  className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}

            {isSystemManager && (
              <input
                type="text"
                placeholder="System Manager ID"
                value={loginData.managerId}
                onChange={(e) => setLoginData({ ...loginData, managerId: e.target.value })}
                className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            <input
              type="password"
              placeholder={t("password")}
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              className="w-full border border-slate-200 p-3 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full px-6 py-3.5 bg-blue-600 text-white rounded-xl text-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? t("processing") : showRegister ? t("register") : t("login")}
            </button>

            {!isSystemManager && (
              <button
                onClick={() => {
                  setShowRegister(!showRegister);
                  clearMessages();
                }}
                className="text-base text-blue-600 hover:underline mt-2"
              >
                {showRegister ? t("already_have_account") : t("dont_have_account")}
              </button>
            )}

            <button
              onClick={() => {
                switchRole("system_manager");
                setShowRegister(false);
              }}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 text-slate-600 hover:text-blue-700 text-sm"
              title="System Manager Login"
            >
              <ShieldCheck size={16} /> System Manager access
            </button>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 text-xs text-blue-700">
              Predefined manager login: ID <span className="font-bold">sysmanager</span> | Password <span className="font-bold">SysManager@123</span>
            </div>
            <button
              onClick={onBookAppointment}
              className="w-full mt-2 px-6 py-3 rounded-xl text-base font-bold border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
            >
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemManagerView({ managerId, onLogout, onOpenDoctorApprovals, onOpenHistory }) {
  const [requests, setRequests] = useState([]);
  const [deliveryRequests, setDeliveryRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryRejectModal, setDeliveryRejectModal] = useState({
    open: false,
    deliveryBoyId: null,
    name: "",
    reason: "",
  });

  const fetchPharmacistRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/system-manager/pharmacist-requests`, {
        manager_id: managerId,
      });
      if (res.data?.success) {
        setRequests(res.data.requests || []);
      } else {
        setError(res.data?.message || "Failed to load pharmacist requests");
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to load pharmacist requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryRequests = async () => {
    setDeliveryLoading(true);
    setDeliveryError("");
    try {
      const res = await axios.post(`${API_BASE}/delivery/manager/pending`, {
        manager_id: managerId,
      });
      if (res.data?.success) {
        setDeliveryRequests(res.data.requests || []);
      } else {
        setDeliveryError(res.data?.message || "Failed to load delivery requests");
      }
    } catch (err) {
      setDeliveryError(err.response?.data?.detail || err.message || "Failed to load delivery requests");
    } finally {
      setDeliveryLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchPharmacistRequests(), fetchDeliveryRequests()]);
  };

  useEffect(() => {
    if (!managerId) return;
    refreshAll();
  }, [managerId]);

  const handlePharmacistAction = async (requestId, action) => {
    setActionLoadingId(`pharmacy-${requestId}`);
    setError("");
    try {
      const res = await axios.post(
        `${API_BASE}/auth/system-manager/pharmacist-requests/${requestId}/${action}`,
        {
          manager_id: managerId,
        }
      );
      if (!res.data?.success) {
        setError(res.data?.message || `Failed to ${action} request`);
      }
      await fetchPharmacistRequests();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || `Failed to ${action} request`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeliveryApproval = async (deliveryBoyId, approved, reason = "") => {
    const actionKey = `delivery-${deliveryBoyId}`;
    setActionLoadingId(actionKey);
    setDeliveryError("");
    try {
      const res = await axios.post(`${API_BASE}/delivery/manager/approve`, {
        delivery_boy_id: deliveryBoyId,
        manager_id: managerId,
        approved,
        reason: reason.trim() || null,
      });
      if (!res.data?.success) {
        setDeliveryError(res.data?.message || "Failed to update delivery request");
      }
      setDeliveryRejectModal({ open: false, deliveryBoyId: null, name: "", reason: "" });
      await fetchDeliveryRequests();
    } catch (err) {
      setDeliveryError(err.response?.data?.detail || err.message || "Failed to update delivery request");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-cyan-50 to-sky-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white rounded-2xl shadow-xl border border-blue-100 px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-blue-900">System Manager Panel</h1>
            <p className="text-slate-600 text-base mt-1">Approve pharmacist and delivery partner requests from one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDoctorApprovals}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Doctor Approvals
            </button>
            <button
              onClick={onOpenHistory}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 transition"
            >
              History
            </button>
            <button
              onClick={refreshAll}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 transition"
            >
              Refresh All
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Pending Pharmacist Requests</h2>
            <button
              onClick={fetchPharmacistRequests}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading pharmacist requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-slate-500">No pending pharmacist requests.</div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.request_id}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <div className="text-lg font-bold text-slate-800">{req.store_name || req.name}</div>
                    <div className="text-sm text-slate-600">Owner: {req.owner_name || req.name}</div>
                    <div className="text-sm text-slate-600">Pharma ID: {req.pharma_id || req.shop_id}</div>
                    <div className="text-sm text-slate-600">Mobile: {req.mobile_number || req.phone}</div>
                    <div className="text-sm text-slate-600">Email: {req.email}</div>
                    <div className="text-sm text-slate-600">License: {req.pharmacy_license_number}</div>
                    <div className="text-xs text-slate-500 mt-1">Requested: {req.created_at}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePharmacistAction(req.request_id, "approve")}
                      disabled={actionLoadingId === `pharmacy-${req.request_id}`}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handlePharmacistAction(req.request_id, "reject")}
                      disabled={actionLoadingId === `pharmacy-${req.request_id}`}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Pending Delivery Boy Requests</h2>
            <button
              onClick={fetchDeliveryRequests}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              Refresh
            </button>
          </div>

          {deliveryError && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-200 text-red-700 text-sm">
              {deliveryError}
            </div>
          )}

          {deliveryLoading ? (
            <div className="py-12 text-center text-slate-500">Loading delivery requests...</div>
          ) : deliveryRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-500">No pending delivery requests.</div>
          ) : (
            <div className="space-y-3">
              {deliveryRequests.map((req) => (
                <div
                  key={req.id}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <div className="text-lg font-bold text-slate-800">{req.name}</div>
                    <div className="text-sm text-slate-600">Phone: {req.phone}</div>
                    <div className="text-sm text-slate-600">Age: {req.age}</div>
                    <div className="text-sm text-slate-600">Gender: {req.gender}</div>
                    <div className="text-xs text-slate-500 mt-1">Requested: {req.created_at}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeliveryApproval(req.id, true)}
                      disabled={actionLoadingId === `delivery-${req.id}`}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setDeliveryRejectModal({ open: true, deliveryBoyId: req.id, name: req.name, reason: "" })}
                      disabled={actionLoadingId === `delivery-${req.id}`}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {deliveryRejectModal.open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeliveryRejectModal({ open: false, deliveryBoyId: null, name: "", reason: "" })}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-slate-900">Reject Delivery Boy Request</h3>
              <p className="mt-2 text-sm text-slate-600">
                Enter the rejection reason for {deliveryRejectModal.name || "this request"}.
              </p>
              <textarea
                rows="4"
                value={deliveryRejectModal.reason}
                onChange={(e) => setDeliveryRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for rejection"
                className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setDeliveryRejectModal({ open: false, deliveryBoyId: null, name: "", reason: "" })}
                  className="rounded-xl bg-slate-200 px-4 py-2 font-medium text-slate-900 hover:bg-slate-300"
                >
                  Back
                </button>
                <button
                  onClick={() => handleDeliveryApproval(deliveryRejectModal.deliveryBoyId, false, deliveryRejectModal.reason)}
                  disabled={!deliveryRejectModal.reason.trim() || actionLoadingId === `delivery-${deliveryRejectModal.deliveryBoyId}`}
                  className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  // ⚠️ ALL HOOKS MUST BE CALLED HERE IN SAME ORDER EVERY RENDER
  useEffect(() => {
    initializeAuthToken();
  }, []);
  
  // Login / Role State
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null); // Store logged-in user data
  const [sessionId, setSessionId] = useState(null); // store backend session/user id

  function performLogout() {
    clearAuthToken();
    setRole(null);
    setUser(null);
    setSessionId(null);
    setView("dashboard");
  }

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    profilePic: null,
    showPassword: false,
    newPassword: ""
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [orderLocationModal, setOrderLocationModal] = useState({
    open: false,
    productName: "",
    quantity: 1,
    pendingOrderToken: "",
    manualAddress: "",
    selectedLabel: "",
    mapUrl: "",
    saving: false,
    error: "",
  });
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  // Navigation State
  const [view, setView] = useState("dashboard");
  const [publicView, setPublicView] = useState(null);

  // Nearby Shops State
  const [nearbyShops, setNearbyShops] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [userLocation, setUserLocation] = useState({
    lat: DEFAULT_PROJECT_LOCATION.lat,
    lng: DEFAULT_PROJECT_LOCATION.lng,
  });
  const [nearbyPolling, setNearbyPolling] = useState(false);
  const [manualCoords, setManualCoords] = useState({
    lat: DEFAULT_PROJECT_LOCATION.lat.toFixed(6),
    lng: DEFAULT_PROJECT_LOCATION.lng.toFixed(6),
  });
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyLocationLabel, setNearbyLocationLabel] = useState(DEFAULT_PROJECT_LOCATION.label);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  
  // Product / Catalog State
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const formatPrice = (value) => {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) return value ?? "";
    return number.toFixed(2);
  };

  const getProductDescription = (p) =>
    p?.description_simple_en || p?.description_en || p?.description || t("no_description");

  // Chat States
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { 
      role: "bot",
      text: I18N.en.welcome_message
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceAssistantOn, setIsVoiceAssistantOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [lastInputLanguage, setLastInputLanguage] = useState("en");
  const [reportInput, setReportInput] = useState("");
  const [reportMessages, setReportMessages] = useState([
    {
      role: "bot",
      text: "Upload a medical report and ask questions. I will answer only from the report details.",
    },
  ]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSessionId, setReportSessionId] = useState(null);
  const [reportChatLanguage, setReportChatLanguage] = useState("en");

// History States
const [orderHistory, setOrderHistory] = useState([]);
const [loadingHistory, setLoadingHistory] = useState(false);
const [cancellingOrderId, setCancellingOrderId] = useState(null);

// Realtime Dashboard States (user dashboard)
const [liveOrders, setLiveOrders] = useState([]);
const [, setLiveRefills] = useState([]);
const [liveNearby, setLiveNearby] = useState([]);
const [ordersFilter, setOrdersFilter] = useState("all");

// 🔔 Reminder States
const [reminderModal, setReminderModal] = useState(null); 
const [reminderForm, setReminderForm] = useState({ days: 0, hours: 1 }); // Default 1 hour
  const [reminderLoading, setReminderLoading] = useState(false);
  const stripMarkdownForSpeech = (text = "") =>
    String(text)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
      .replace(/[#>*_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const detectMessageLanguage = (text = "", fallback = "en") => {
    const msg = String(text || "").trim().toLowerCase();
    if (!msg) return fallback;
    const hasDevanagari = /[\u0900-\u097F]/.test(msg);
    if (!hasDevanagari) return "en";
    const marathiHints = ["आहे", "आणि", "तुमचा", "माझा", "काय", "मध्ये", "तुम्ही", "कृपया"];
    const hindiHints = ["है", "और", "क्या", "आप", "कृपया", "मेरा", "मुझे", "करें"];
    const mrScore = marathiHints.reduce((n, w) => n + (msg.includes(w) ? 1 : 0), 0);
    const hiScore = hindiHints.reduce((n, w) => n + (msg.includes(w) ? 1 : 0), 0);
    if (mrScore > hiScore) return "mr";
    if (hiScore > mrScore) return "hi";
    return fallback === "mr" || fallback === "hi" ? fallback : "hi";
  };

  const speakBotText = (rawText, langCode = "en") => {
    if (!window.speechSynthesis || !rawText) return;
    const text = stripMarkdownForSpeech(rawText);
    if (!text) return;

    const utter = new SpeechSynthesisUtterance(text);
    const langMap = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
    const targetLang = langMap[langCode] || langMap[preferredLanguage] || "en-IN";
    utter.lang = targetLang;
    utter.rate = 1;
    utter.pitch = 1;
    utter.onstart = () => {
      isSpeakingRef.current = true;
      if (recognitionRef.current && isListening) {
        manualMicStopRef.current = true;
        recognitionRef.current.stop();
      }
      setIsListening(false);
    };
    utter.onend = () => {
      isSpeakingRef.current = false;
      if (shouldResumeListeningRef.current) {
        setTimeout(() => {
          if (!isSpeakingRef.current && !loading) {
            try {
              setIsListening(true);
              recognitionRef.current?.start();
            } catch {
              // Ignore repeated browser speech-start attempts.
            }
          }
        }, 260);
      }
    };
    utter.onerror = () => {
      isSpeakingRef.current = false;
    };

    const voices = window.speechSynthesis.getVoices() || [];
    const baseLang = (langCode || preferredLanguage || "en").toLowerCase();
    const voice =
      voices.find((v) => v.lang?.toLowerCase() === targetLang.toLowerCase()) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(baseLang)) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
      voices[0];
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang || targetLang;
    }

    window.speechSynthesis.cancel();
    try {
      window.speechSynthesis.speak(utter);
    } catch (speechError) {
      console.error("Speech synthesis failed:", speechError);
    }
  };

  const startVoiceCapture = () => {
    if (!recognitionRef.current) return;
    if (isSpeakingRef.current || loading) return;
    try {
      setIsListening(true);
      recognitionRef.current.start();
    } catch {
      // Ignore repeated browser speech-start attempts.
    }
  };

const handleSetReminder = async () => {
    if (reminderForm.days === 0 && reminderForm.hours === 0) {
      alert(t("select_time_error"));
      return;
    }

    setReminderLoading(true);
    try {
      const currentSessionId = sessionId || (user ? user.id : "guest");
      const res = await axios.post(`${API_BASE}/refill/schedule-reminder`, {
        patient_id: currentSessionId,
        product_name: reminderModal.productName,
        days: parseInt(reminderForm.days) || 0,
        hours: parseInt(reminderForm.hours) || 0
      });

      if (res.data.success) {
        alert("✅ " + res.data.message);
        setReminderModal(null); // close modal
        setReminderForm({ days: 0, hours: 1 }); // Reset to default
      } else {
        alert("❌ " + res.data.message);
      }
    } catch (error) {
      alert(t("connection_error"));
      console.error("Reminder error:", error);
    } finally {
      setReminderLoading(false);
    }
  };

  // Refs
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const reportFileInputRef = useRef(null);
  const socketRef = useRef(null);
  const shouldResumeListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const manualMicStopRef = useRef(false);
  const hasSpokenTestRef = useRef(false);
  const speechDraftRef = useRef("");
  const hasSentFromSpeechRef = useRef(false);

  // Effects - all called in same order every render
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const segment = event.results[i]?.[0]?.transcript || "";
          if (event.results[i].isFinal) {
            finalChunk += `${segment} `;
          } else {
            interimChunk += `${segment} `;
          }
        }

        if (finalChunk.trim()) {
          speechDraftRef.current = `${speechDraftRef.current} ${finalChunk}`.trim();
        }

        const visibleText = `${speechDraftRef.current} ${interimChunk}`.trim();
        if (visibleText) {
          setInput(visibleText);
        }

        if (shouldResumeListeningRef.current && finalChunk.trim()) {
          const msg = speechDraftRef.current.trim();
          if (msg) {
            hasSentFromSpeechRef.current = true;
            handleSend(msg);
            speechDraftRef.current = "";
            setInput("");
            manualMicStopRef.current = true;
            recognitionRef.current?.stop();
          }
        }
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (manualMicStopRef.current) {
          manualMicStopRef.current = false;
          return;
        }
        if (hasSentFromSpeechRef.current) {
          hasSentFromSpeechRef.current = false;
          return;
        }
        if (shouldResumeListeningRef.current && speechDraftRef.current.trim()) {
          const msg = speechDraftRef.current.trim();
          speechDraftRef.current = "";
          setInput("");
          hasSentFromSpeechRef.current = true;
          handleSend(msg);
          return;
        }
        if (shouldResumeListeningRef.current && !isSpeakingRef.current && !loading) {
          setTimeout(() => {
            if (!isSpeakingRef.current && !loading) {
              try {
                setIsListening(true);
                recognitionRef.current?.start();
              } catch {
                // Ignore repeated browser speech-start attempts.
              }
            }
          }, 280);
        }
      };
    }
  }, []);

  const t = (key, vars = {}) => {
    const lang = preferredLanguage || "en";
    const str = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    return Object.keys(vars).reduce((acc, k) => acc.replaceAll(`{${k}}`, vars[k]), str);
  };

  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const onVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", onVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
    };
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    if (messages.length === 1 && messages[0].role === "bot") {
      setMessages([{ role: "bot", text: t("welcome_message") }]);
    }
  }, [preferredLanguage]);

  useEffect(() => {
    if (!recognitionRef.current) return;
    const map = { en: "en-US", hi: "hi-IN", mr: "mr-IN" };
    recognitionRef.current.lang = map[preferredLanguage] || "en-US";
  }, [preferredLanguage]);

  useEffect(() => {
    if (view === "report_chat") {
      setReportChatLanguage((prev) => prev || preferredLanguage || "en");
    }
  }, [view, preferredLanguage]);

  useEffect(() => {
    if (!isSpeakerOn || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "bot" || !last?.text) return;
    speakBotText(last.text, last.language || lastInputLanguage || preferredLanguage);
  }, [messages, isSpeakerOn, preferredLanguage, lastInputLanguage]);

  useEffect(() => {
    if (isSpeakerOn) return;
    if (isVoiceAssistantOn) {
      setIsSpeakerOn(true);
      return;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isSpeakerOn, isVoiceAssistantOn]);

  useEffect(() => {
    shouldResumeListeningRef.current = isVoiceAssistantOn;
    if (!isVoiceAssistantOn) {
      setIsListening(false);
      speechDraftRef.current = "";
      hasSentFromSpeechRef.current = false;
    }
  }, [isVoiceAssistantOn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, view]);

  useEffect(() => {
    if (view !== "report_chat") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reportMessages, reportLoading, view]);

  // --- HISTORY LOGIC ---
  async function loadOrderHistory() {
    setLoadingHistory(true);
    try {
      const currentSessionId = sessionId || (user ? user.id : "guest");
      const res = await axios.get(`${API_BASE}/patients/${currentSessionId}/history`);
      setOrderHistory(res.data);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setLoadingHistory(false);
    }
  }

  const handleCancelOrder = async (orderId) => {
    if (!orderId) return;
    setCancellingOrderId(orderId);
    try {
      const currentSessionId = sessionId || (user ? user.id : "guest");
      const res = await axios.post(`${API_BASE}/orders/${orderId}/cancel`, {
        patient_id: currentSessionId
      });
      if (res.data?.success) {
        await loadOrderHistory();
        fetchProducts();
      } else {
        alert(res.data?.message || "Failed to cancel order");
      }
    } catch (error) {
      alert("Failed to cancel order");
      console.error("Cancel order error:", error);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const parseOrderDate = (rawDate) => {
    if (!rawDate) return null;
    try {
      let parsedDateStr = rawDate;
      if (typeof rawDate === "string" && rawDate.includes(" ") && !rawDate.includes("T")) {
        parsedDateStr = rawDate.replace(" ", "T");
        if (!parsedDateStr.endsWith("Z")) parsedDateStr += "Z";
      }
      const d = new Date(parsedDateStr);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const normalizeStatus = (raw) => {
    const value = String(raw || "").toLowerCase();
    if (value.includes("cancel")) return "cancelled";
    if (value.includes("deliver") || value.includes("complete")) return "completed";
    if (value.includes("process")) return "pending";
    return "pending";
  };

  const normalizeOrder = (item, fallbackIndex = 0) => {
    const name =
      item?.product_name ||
      item?.["Product Name"] ||
      item?.product ||
      "Unknown Medicine";
    const quantity = item?.quantity || item?.["Quantity"] || 1;
    const rawDate = item?.created_at || item?.purchase_date || item?.["Purchase date"] || item?.date;
    const dateObj = parseOrderDate(rawDate) || new Date();
    return {
      id: item?.order_id || item?.["Order ID"] || `${fallbackIndex}-${name}`,
      name,
      quantity,
      status: normalizeStatus(item?.status || item?.["Status"]),
      updatedAt: dateObj.toISOString(),
    };
  };

  const buildLiveOrders = (history = []) => {
    const normalized = history.map(normalizeOrder);
    const seen = new Set();
    const deduped = [];
    normalized
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .forEach((order) => {
        const key = String(order.id || "");
        if (!key || seen.has(key)) return;
        seen.add(key);
        deduped.push(order);
      });
    return deduped;
  };

  const buildLiveRefills = () => {
    return [];
  };

  const buildLiveNearby = (shops = []) => {
    if (shops.length) {
      return shops.map((shop, idx) => ({
        id: shop?.id || `${idx}-${shop?.name || "Pharmacy"}`,
        name: shop?.name || shop?.shop_name || `Pharmacy ${idx + 1}`,
        address: shop?.address || "",
        distanceKm: Number(shop?.distance_km ?? shop?.distance ?? 0).toFixed(2),
        isOpen: Boolean(shop?.is_open ?? shop?.open ?? false),
        stock: shop?.stock_status || "Unknown",
        mapUrl:
          shop?.map_url ||
          (shop?.lat != null && shop?.lng != null
            ? `https://www.google.com/maps?q=${shop.lat},${shop.lng}`
            : null),
      }));
    }
    return [];
  };

  const normalizeRefill = (item, idx = 0) => {
    const name = item?.name || item?.product_name || item?.medicine || `Medicine ${idx + 1}`;
    const usedPctRaw = item?.usedPct ?? item?.used_pct ?? item?.usage_percent ?? 65;
    const daysLeftRaw = item?.daysLeft ?? item?.days_left ?? item?.refill_in_days ?? 3;
    const usedPct = Math.min(100, Math.max(0, Number(usedPctRaw)));
    const daysLeft = Math.max(0, Number(daysLeftRaw));
    return {
      id: item?.id || `${name}-${idx}`,
      name,
      usedPct,
      daysLeft,
      dosage: item?.dosage || "1-0-1",
      predicted: Math.max(1, Math.ceil(daysLeft - 1)),
    };
  };

const normalizeNearby = (item, idx = 0) => ({
  id: item?.id || `${idx}-${item?.name || "Pharmacy"}`,
  name: item?.name || item?.shop_name || `Pharmacy ${idx + 1}`,
  address: item?.address || "",
  distanceKm: Number(item?.distance_km ?? item?.distance ?? 0).toFixed(2),
  isOpen: Boolean(item?.is_open ?? item?.open ?? false),
  stock: item?.stock_status || "Unknown",
  mapUrl:
    item?.map_url ||
    (item?.lat != null && item?.lng != null
      ? `https://www.google.com/maps?q=${item.lat},${item.lng}`
      : null),
});

  const timeAgo = (isoDate) => {
    const date = isoDate ? new Date(isoDate) : new Date();
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // When user navigates to products, dashboard or history pages, load product catalog
  useEffect(() => {
  if (view === "products" || view === "dashboard" || view === "history" || view === "orders") {
    fetchProducts();
  }
    if (role !== "user") return;
    if (view === "history" || view === "dashboard" || view === "orders") {
      loadOrderHistory();
    }
  }, [view, role]);

  useEffect(() => {
    if (role !== "user") return;
    if (view !== "dashboard" && view !== "orders" && view !== "history") return;
    const timer = setInterval(() => {
      loadOrderHistory();
    }, 12000);
    return () => clearInterval(timer);
  }, [view, sessionId, user?.id, role]);

  useEffect(() => {
    if (socketRef.current) return;
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected", socket.id);
    });

    socket.on("order_update", (payload) => {
      if (Array.isArray(payload)) {
        setLiveOrders(buildLiveOrders(payload));
        return;
      }
      if (payload) {
        const incoming = normalizeOrder(payload);
        setLiveOrders((prev) => {
          const next = prev.filter((o) => o.id !== incoming.id);
          return buildLiveOrders([incoming, ...next]);
        });
      }
    });

    socket.on("refill_alert", (payload) => {
      if (Array.isArray(payload)) {
        setLiveRefills(payload.map(normalizeRefill));
        return;
      }
      if (payload) {
        const incoming = normalizeRefill(payload);
        setLiveRefills((prev) => {
          const next = prev.filter((r) => r.id !== incoming.id);
          return [incoming, ...next].slice(0, 4);
        });
      }
    });

    socket.on("nearby_update", (payload) => {
      if (Array.isArray(payload)) {
        setLiveNearby(payload.map(normalizeNearby));
        return;
      }
      if (payload) {
        const incoming = normalizeNearby(payload);
        setLiveNearby((prev) => {
          const next = prev.filter((s) => s.id !== incoming.id);
          return [incoming, ...next].slice(0, 4);
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (view !== "dashboard" && view !== "orders") return;
    setLiveOrders(buildLiveOrders(orderHistory));
  }, [view, orderHistory]);

  useEffect(() => {
    if (view !== "dashboard" && view !== "orders") return;
    setLiveRefills(buildLiveRefills());
  }, [view, orderHistory, products]);

  useEffect(() => {
    if (view !== "dashboard" && view !== "orders") return;
    setLiveNearby(buildLiveNearby(nearbyShops));
  }, [view, nearbyShops]);

  // No synthetic/random dashboard mutations. Use only backend/socket data.

  useEffect(() => {
    if (view !== "nearby") return;
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [DEFAULT_PROJECT_LOCATION.lat, DEFAULT_PROJECT_LOCATION.lng],
        13
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapRef.current);
    }
    if (mapRef.current) {
      setTimeout(() => {
        try {
          mapRef.current.invalidateSize();
        } catch {
          // Ignore map resize timing issues during initial mount.
        }
      }, 50);
    }
  }, [view]);

  const getUserLocation = () =>
    Promise.resolve({
      lat: DEFAULT_PROJECT_LOCATION.lat,
      lng: DEFAULT_PROJECT_LOCATION.lng,
    });

  const clearMapLayers = () => {
    if (markersRef.current.length) {
      markersRef.current.forEach((m) => mapRef.current && mapRef.current.removeLayer(m));
      markersRef.current = [];
    }
    if (routeRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeRef.current);
      routeRef.current = null;
    }
  };

  const renderMarkers = (shops, location) => {
    if (!mapRef.current) return;
    clearMapLayers();
    if (location) {
      const userMarker = L.marker([location.lat, location.lng]).addTo(mapRef.current);
      markersRef.current.push(userMarker);
    }
    shops.forEach((s) => {
      const m = L.marker([s.lat, s.lng]).addTo(mapRef.current);
      m.bindPopup(`<strong>${s.name}</strong><br/>${s.address || ""}`);
      markersRef.current.push(m);
    });
    if (shops.length) {
      const group = L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds().pad(0.2));
    }
  };

  const drawRoute = (coords) => {
    if (!mapRef.current || !coords.length) return;
    if (routeRef.current) {
      mapRef.current.removeLayer(routeRef.current);
    }
    routeRef.current = L.polyline(coords, { color: "#2563eb", weight: 4 }).addTo(mapRef.current);
    mapRef.current.fitBounds(routeRef.current.getBounds().pad(0.2));
  };

  const fetchNearby = async (lat, lng) => {
    setNearbyLoading(true);
    setNearbyError("");
    try {
      const radiusSteps = [3000, 5000, 10000];
      let shops = [];
      let usedRadius = radiusSteps[0];

      for (const radius of radiusSteps) {
        const res = await axios.get(`${API_BASE}/nearby/shops`, {
          params: { lat, lng, radius }
        });
        shops = res.data?.shops || [];
        usedRadius = radius;
        if (shops.length) break;
      }

      setNearbyShops(shops);
      renderMarkers(shops, { lat, lng });
      if (!shops.length) {
        setNearbyError("No pharmacies found near your current location. Try search place or manual coordinates.");
      } else if (usedRadius > radiusSteps[0]) {
        setNearbyError(`Showing pharmacies found within ${usedRadius / 1000} km of your current location.`);
      }
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 14);
        mapRef.current.invalidateSize();
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setNearbyError(detail ? `Nearby search failed: ${detail}` : t("route_error"));
    } finally {
      setNearbyLoading(false);
    }
  };

  const handleUseLocation = async () => {
    try {
      const loc = await getUserLocation();
      setUserLocation(loc);
      setManualCoords({
        lat: Number(loc.lat).toFixed(6),
        lng: Number(loc.lng).toFixed(6),
      });
      setNearbyLocationLabel(`Current location: ${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}`);
      try {
        const res = await axios.get(`${API_BASE}/nearby/reverse`, {
          params: { lat: loc.lat, lng: loc.lng },
        });
        const label = res.data?.display_name || "";
        if (label) {
          setNearbyLocationLabel(label);
          setPlaceQuery(label);
        }
      } catch {
        // Keep coordinate fallback label if reverse geocoding fails.
      }
      fetchNearby(loc.lat, loc.lng);
    } catch (err) {
      const code = err?.code;
      if (code === 1) {
        setNearbyError("Location permission denied. Use manual latitude/longitude below.");
      } else if (code === 2) {
        setNearbyError("Location unavailable. Please enter latitude/longitude manually.");
      } else if (code === 3) {
        setNearbyError("Location request timed out. Please try again or enter coordinates manually.");
      } else {
        setNearbyError(t("location_error"));
      }
    }
  };

  useEffect(() => {
    if (view !== "nearby") return;
    if (nearbyShops.length || nearbyLoading) return;
    setUserLocation({ lat: DEFAULT_PROJECT_LOCATION.lat, lng: DEFAULT_PROJECT_LOCATION.lng });
    setManualCoords({
      lat: DEFAULT_PROJECT_LOCATION.lat.toFixed(6),
      lng: DEFAULT_PROJECT_LOCATION.lng.toFixed(6),
    });
    setNearbyLocationLabel(DEFAULT_PROJECT_LOCATION.label);
    fetchNearby(DEFAULT_PROJECT_LOCATION.lat, DEFAULT_PROJECT_LOCATION.lng);
  }, [view]);

  const handleManualNearbySearch = () => {
    const lat = Number(manualCoords.lat);
    const lng = Number(manualCoords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setNearbyError("Please enter valid numeric latitude and longitude.");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setNearbyError("Latitude must be between -90 and 90, longitude between -180 and 180.");
      return;
    }
    const loc = { lat, lng };
    setUserLocation(loc);
    setNearbyLocationLabel(`Manual location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    fetchNearby(lat, lng);
  };

  const handlePlaceSearch = async () => {
    const q = (placeQuery || "").trim();
    if (q.length < 2) {
      setNearbyError("Please enter at least 2 characters to search place.");
      return;
    }
    setNearbyError("");
    setPlaceLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/nearby/geocode`, {
        params: { query: q, limit: 5 },
      });
      const places = res.data?.places || [];
      setPlaceResults(places);
      if (!places.length) {
        setNearbyError("No matching place found. Try a more specific query.");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setNearbyError(detail ? `Place search failed: ${detail}` : "Unable to search place right now.");
      setPlaceResults([]);
    } finally {
      setPlaceLoading(false);
    }
  };

  const handlePickPlace = (place) => {
    if (!place) return;
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setNearbyError("Selected place has invalid coordinates.");
      return;
    }
    setManualCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    setUserLocation({ lat, lng });
    setNearbyLocationLabel(place.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setPlaceQuery(place.display_name || "");
    setPlaceResults([]);
    setNearbyError("");
    fetchNearby(lat, lng);
  };

  const handleRouteTo = async (shop) => {
    if (!userLocation) return;
    try {
      setNearbyError("");
      const res = await axios.get(`${API_BASE}/nearby/route`, {
        params: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          shop_lat: shop.lat,
          shop_lng: shop.lng
        }
      });
      const coords = res.data?.route || [];
      drawRoute(coords);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setNearbyError(detail ? `Route failed: ${detail}` : t("route_error"));
    }
  };

  useEffect(() => {
    if (view !== "nearby") return;
    if (!nearbyPolling) return;
    if (!userLocation) return;
    const id = setInterval(() => {
      fetchNearby(userLocation.lat, userLocation.lng);
    }, 10000);
    return () => clearInterval(id);
  }, [nearbyPolling, userLocation, view]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/products?english=true`);
      setProducts(res.data || []);
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      setProductsLoading(false);
    }
  };

  const goToView = (target) => {
    setView(target);
  };

  // Image upload handler
const handleImageUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      sendImageMessage(reader.result);
    };
    reader.readAsDataURL(file);
  }
  e.target.value = null;
};

const handleReportUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      sendReportForAnalysis(reader.result);
    };
    reader.readAsDataURL(file);
  }
  e.target.value = null;
};

const openOrderLocationModal = (pendingOrder = {}) => {
  setOrderLocationModal({
    open: true,
    productName: pendingOrder.product_name || "",
    quantity: pendingOrder.quantity || 1,
    pendingOrderToken: pendingOrder.pending_order_token || "",
    manualAddress: "",
    selectedLabel: "",
    mapUrl: "",
    saving: false,
    error: "",
  });
};

const closeOrderLocationModal = () => {
  setOrderLocationModal({
    open: false,
    productName: "",
    quantity: 1,
    pendingOrderToken: "",
    manualAddress: "",
    selectedLabel: "",
    mapUrl: "",
    saving: false,
    error: "",
  });
};

const applyChatResponse = (data, languageCode) => {
  const botText = data.message || data.reason || t("input_placeholder");
  const botReceipt = data.receipt || null;
  setMessages((prev) => [...prev, { role: "bot", text: botText, receipt: botReceipt, language: languageCode }]);
  if (data.needs_location) {
    openOrderLocationModal(data.pending_order || {});
  }
};

  const sendImageMessage = async (base64Image) => {
  const userMsg = {
    role: "user",
    text: `📄 *${t("uploaded_doc")}*`,
    image: base64Image
  };

  setMessages((prev) => [...prev, userMsg]);
  setLoading(true);

  try {
    const requestLanguage = detectMessageLanguage(input, preferredLanguage);
    setLastInputLanguage(requestLanguage);
    const res = await axios.post(`${API_BASE}/chat`, {
      message: "Uploaded prescription image",
      session_id: sessionId || "guest",
      image: base64Image,
      language: requestLanguage
    });
    applyChatResponse(res.data, requestLanguage);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.message || "Error uploading prescription";
    setMessages((prev) => [...prev, { role: "bot", text: `❌ ${errorMsg}` }]);
    console.error("Image upload error:", err);
  } finally {
    setLoading(false);
  }
};

  const sendReportForAnalysis = async (base64Image) => {
    const userMsg = {
      role: "user",
      text: `📑 *${t("uploaded_report")}*`,
      image: base64Image
    };
    setReportMessages((prev) => [...prev, userMsg]);
    setReportLoading(true);

    try {
      const requestLanguage = reportChatLanguage || preferredLanguage || "en";
      const res = await axios.post(`${API_BASE}/report/analyze`, {
        image: base64Image,
        language: requestLanguage
      });
      const botText = res.data?.message || "Could not analyze report.";
      const newSessionId = res.data?.report_session_id || null;
      setReportSessionId(newSessionId);
      setReportMessages((prev) => [...prev, { role: "bot", text: botText, language: requestLanguage }]);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || err.message || "Error analyzing report";
      setReportMessages((prev) => [...prev, { role: "bot", text: `❌ ${errorMsg}` }]);
    } finally {
      setReportLoading(false);
    }
  };

  const handleSendReportQuestion = async (customQuestion = null) => {
    const question = (customQuestion || reportInput || "").trim();
    if (!question) return;

    const userMsg = { role: "user", text: question, language: reportChatLanguage };
    setReportMessages((prev) => [...prev, userMsg]);
    setReportInput("");

    if (!reportSessionId) {
      setReportMessages((prev) => [...prev, { role: "bot", text: `⚠️ ${t("report_upload_first")}` }]);
      return;
    }

    setReportLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/report/chat`, {
        session_id: reportSessionId,
        question,
        language: reportChatLanguage,
      });
      const botText = res.data?.message || "I could not answer this question from the report.";
      setReportMessages((prev) => [...prev, { role: "bot", text: botText, language: reportChatLanguage }]);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || err.message || "Report Q&A failed";
      setReportMessages((prev) => [...prev, { role: "bot", text: `❌ ${errorMsg}` }]);
    } finally {
      setReportLoading(false);
    }
  };
  // Helper function to toggle microphone
  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isVoiceAssistantOn) {
      const composedDraft = `${speechDraftRef.current || ""} ${input || ""}`.trim();
      shouldResumeListeningRef.current = false;
      setIsVoiceAssistantOn(false);
      manualMicStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (composedDraft) {
        hasSentFromSpeechRef.current = true;
        handleSend(composedDraft);
      } else {
        hasSentFromSpeechRef.current = false;
      }
      speechDraftRef.current = "";
      setInput("");
      return;
    }

    shouldResumeListeningRef.current = true;
    speechDraftRef.current = "";
    hasSentFromSpeechRef.current = false;
    setIsVoiceAssistantOn(true);
    setIsSpeakerOn(true);
    startVoiceCapture();
  };

  // Handle login - receives user data from auth endpoint
  const handleLogin = (selectedRole, userData, sessionIdFromServer) => {
    setLiveOrders([]);
    setLiveRefills([]);
    setLiveNearby([]);
    setRole(selectedRole);
    setUser(userData);
    setSessionId(sessionIdFromServer || userData?.id || null);
    setProfileData({
      name: userData?.name || "",
      phone: userData?.phone || "",
      profilePic: null,
      showPassword: false,
      newPassword: ""
    });
    setPreferredLanguage(userData?.preferred_language || "en");
    if (userData?.access_token) {
      setAuthToken(userData.access_token);
    }
    if (selectedRole === "system_manager") {
      setView("manager");
    } else if (selectedRole === "delivery_boy") {
      setView("delivery_dashboard");
    } else if (selectedRole === "doctor") {
      setView("doctor_dashboard");
    } else {
      setView("dashboard");
    }
  };

  const openProfileModal = () => {
    setProfileData({
      name: user?.name || "",
      phone: user?.phone || "",
      profilePic: null,
      showPassword: false,
      newPassword: ""
    });
    setPreferredLanguage(user?.preferred_language || "en");
    setProfileError("");
    setProfileSuccess("");
    setShowProfileModal(true);
  };

  const openManageProfile = () => {
    setProfileData({
      name: user?.name || "",
      phone: user?.phone || "",
      profilePic: null,
      showPassword: false,
      newPassword: ""
    });
    setPreferredLanguage(user?.preferred_language || "en");
    setProfileError("");
    setProfileSuccess("");

    if (role === "user") {
      setView("profile");
      return;
    }

    setShowProfileModal(true);
  };

  if (!role && publicView === "book_appointment") {
    return <BookAppointment onBack={() => setPublicView(null)} currentUser={null} />;
  }

  if (!role) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (role === "doctor") {
    if (view === "doctor_revenue") {
      return (
        <RevenueAnalytics
          doctorId={user?.id || sessionId}
          onBack={() => setView("doctor_dashboard")}
        />
      );
    }
    if (view === "doctor_registration") {
      return (
        <DoctorRegistration
          onBack={() => setView("doctor_dashboard")}
          onSuccess={() => setView("doctor_dashboard")}
        />
      );
    }
    return (
        <DoctorDashboard
          doctorId={user?.id || sessionId}
          doctorName={user?.name || "Doctor"}
          onOpenRevenue={() => setView("doctor_revenue")}
        onLogout={performLogout}
        />
    );
  }

  if (role === "system_manager") {
    if (view === "doctor_approvals") {
      return (
        <SystemManagerDoctorApprovals
          managerId={user?.manager_id || user?.shop_id || "sysmanager"}
          onBack={() => setView("manager")}
          onLogout={performLogout}
        />
      );
    }
    if (view === "manager_history") {
      return (
        <SystemManagerRequestHistory
          managerId={user?.manager_id || user?.shop_id || "sysmanager"}
          onBack={() => setView("manager")}
          onLogout={performLogout}
        />
      );
    }
    return (
      <SystemManagerView
        managerId={user?.manager_id || user?.shop_id}
        onOpenDoctorApprovals={() => setView("doctor_approvals")}
        onOpenHistory={() => setView("manager_history")}
        onLogout={performLogout}
      />
    );
  }

  if (role === "delivery_boy") {
    return (
      <DeliveryBoyDashboard
        deliveryBoy={user}
        onLogout={performLogout}
      />
    );
  }

  // if signed in as admin, render admin dashboard
  if (role === "admin") {
    return <AdminView logout={performLogout} t={t} />;
  }

  if (role === "user" && view === "book_appointment") {
    return <BookAppointment onBack={() => setView("dashboard")} currentUser={user} />;
  }

  if (role === "user" && view === "profile") {
    return (
      <div className={`dashboard-shell ${isDarkMode ? "dash-dark" : ""}`}>
        <div className="dash-layout">
          <aside className="dashboard-sidebar glass-card strong">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <Pill size={22} />
              </div>
              <div>
                <div className="sidebar-title">{t("app_name")}</div>
                <div className="sidebar-subtitle">Smart patient dashboard</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button className="nav-link" onClick={() => goToView("dashboard")}>
                <Home size={18} /> {t("dashboard")}
              </button>
              <button className="nav-link" onClick={() => goToView("chat")}>
                <Bot size={18} /> {t("chat")}
              </button>
              <button className="nav-link" onClick={() => goToView("products")}>
                <ShoppingCart size={18} /> {t("products")}
              </button>
              <button className="nav-link" onClick={() => goToView("orders")}>
                <Package size={18} /> Orders
              </button>
              <button className="nav-link" onClick={() => goToView("book_appointment")}>
                <Calendar size={18} /> Book Appointment
              </button>
              <button className="nav-link active" onClick={() => goToView("profile")}>
                <User size={18} /> Manage Profile
              </button>
            </nav>

            <div className="sidebar-footer">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="pill-btn"
              >
                {isDarkMode ? t("light") : t("dark")}
              </button>
            </div>
          </aside>

          <div className="dash-main">
            <header className="dash-topbar glass-card strong">
              <div>
                <div className="topbar-kicker">{t("profile")}</div>
                <div className="topbar-title">{t("profile_title")}</div>
                <div className="topbar-sub">Update your name, phone number, and preferred language.</div>
              </div>
            </header>

            <main className="p-6">
              <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                {profileError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {profileError}
                  </div>
                )}
                {profileSuccess && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {profileSuccess}
                  </div>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">{t("name")}</label>
                    <input
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder={t("name")}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">{t("phone_number")}</label>
                    <input
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder={t("phone_number")}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900"
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-sm font-medium text-slate-700">{t("language")}</label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                  </select>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => goToView("dashboard")}
                    className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to Dashboard
                  </button>
                  <button
                    onClick={handleProfileSave}
                    disabled={profileSaving}
                    className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {profileSaving ? "Saving..." : t("save")}
                  </button>
                  <button
                    onClick={performLogout}
                    className="rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
                  >
                    {t("logout")}
                  </button>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  
  // --- CHAT LOGIC ---
  const handleSend = async (customMessage = null) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim()) return;
    const requestLanguage = detectMessageLanguage(messageToSend, preferredLanguage);
    setLastInputLanguage(requestLanguage);

    const userMsg = { role: "user", text: messageToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        message: messageToSend,
        session_id: sessionId || "guest",
        language: requestLanguage
      });
      applyChatResponse(res.data, requestLanguage);
    } catch {
      setMessages((prev) => [
        ...prev, 
        { role: "bot", text: t("connection_error") }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const patientId = sessionId || user?.id || "guest";
      const res = await axios.post(`${API_BASE}/refill/send-alerts-whatsapp`, {
        patient_id: patientId
      });
      const msg = res.data?.message || "Refill alerts processed.";
      setMessages((prev) => [...prev, { role: "bot", text: `✅ ${msg}` }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: t("connection_error") }]);
    } finally {
      setLoading(false);
    }
  };

  async function handleProfileSave() {
    const trimmedName = (profileData.name || "").trim();
    const trimmedPhone = (profileData.phone || "").trim();

    if (!trimmedName) {
      setProfileError("Name is required");
      setProfileSuccess("");
      return;
    }
    if (role === "user" && trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      setProfileError("Please enter a valid 10-digit phone number");
      setProfileSuccess("");
      return;
    }

    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const res = await axios.post(`${API_BASE}/auth/profile`, {
        user_id: user?.id || sessionId,
        name: trimmedName,
        phone: trimmedPhone,
        preferred_language: preferredLanguage
      });
      if (res.data?.success) {
        if (res.data?.access_token) {
          setAuthToken(res.data.access_token);
        }
        setUser(res.data.user);
        setPreferredLanguage(res.data.user?.preferred_language || preferredLanguage);
        setProfileSuccess("Profile updated successfully");
        setTimeout(() => {
          setShowProfileModal(false);
          setProfileSuccess("");
        }, 900);
      } else {
        setProfileError(res.data?.message || "Failed to update profile");
      }
    } catch (err) {
      setProfileError(err.response?.data?.message || err.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }

  const handleUseLiveOrderLocation = async () => {
    try {
      const loc = await getUserLocation();
      let label = `Live location: ${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}`;
      try {
        const res = await axios.get(`${API_BASE}/nearby/reverse`, {
          params: { lat: loc.lat, lng: loc.lng },
        });
        label = res.data?.display_name || label;
      } catch {
        // Fall back to coordinates if reverse geocoding is unavailable.
      }
      const mapUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
      setOrderLocationModal((prev) => ({
        ...prev,
        selectedLabel: label,
        manualAddress: "",
        mapUrl,
        error: "",
      }));
    } catch (err) {
      const code = err?.code;
      let message = "Unable to get live location.";
      if (code === 1) message = "Location permission denied.";
      if (code === 2) message = "Location unavailable.";
      if (code === 3) message = "Location request timed out.";
      setOrderLocationModal((prev) => ({ ...prev, error: `${message} Please enter your location manually.` }));
    }
  };

  const submitOrderLocation = async () => {
    const manualAddress = (orderLocationModal.manualAddress || "").trim();
    const label = manualAddress || orderLocationModal.selectedLabel;
    if (!label) {
      setOrderLocationModal((prev) => ({ ...prev, error: "Please enter your location or use live location." }));
      return;
    }

    const requestLanguage = preferredLanguage || "en";
    setOrderLocationModal((prev) => ({ ...prev, saving: true, error: "" }));
    setMessages((prev) => [
      ...prev,
      { role: "user", text: manualAddress ? `Delivery location: ${manualAddress}` : orderLocationModal.selectedLabel }
    ]);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        message: "Delivery location provided",
        session_id: sessionId || "guest",
        language: requestLanguage,
        location: {
          label,
          map_url: orderLocationModal.mapUrl || (manualAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(manualAddress)}` : ""),
          product_name: orderLocationModal.productName || "",
          quantity: Number(orderLocationModal.quantity) || 1,
          pending_order_token: orderLocationModal.pendingOrderToken || "",
        },
      });
      closeOrderLocationModal();
      applyChatResponse(res.data, requestLanguage);
    } catch (err) {
      setOrderLocationModal((prev) => ({
        ...prev,
        saving: false,
        error: err.response?.data?.detail || err.message || "Failed to submit delivery location.",
      }));
    }
  };



  // ==========================================
  // VIEW: DASHBOARD
  // ==========================================
  if (view === "nearby") {
    return (
      <div className={`flex h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-[#F8FAFC]'} transition`}>
        {/* LEFT SIDEBAR */}
        <aside className={`w-64 ${isDarkMode ? 'bg-teal-700' : 'bg-teal-600'} text-white flex flex-col shadow-xl transition`}>
          <div className={`p-6 border-b ${isDarkMode ? 'border-teal-600' : 'border-teal-500'} flex items-center gap-3`}>
            <Pill size={28} className="text-teal-200" />
            <h1 className="text-2xl font-bold tracking-wide">{t("app_name")}</h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => goToView("dashboard")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'dashboard' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}>
              <Home size={20} className={view === 'dashboard' ? 'text-white' : 'text-teal-200'} /> {t("dashboard")}
            </button>
            <button onClick={() => goToView("chat")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'chat' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}>
              <Pill size={20} className={view === 'chat' ? 'text-white' : 'text-teal-200'} /> {t("chat")}
            </button>
            <button onClick={() => goToView("products")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'products' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}>
              <ShoppingCart size={20} className={view === 'products' ? 'text-white' : 'text-teal-200'} /> {t("products")}
            </button>
            
            <button onClick={() => goToView("nearby")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'nearby' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}>
              <Map size={20} className={view === 'nearby' ? 'text-white' : 'text-teal-200'} /> {t("nearby_shops")}
            </button>
          </nav>
          <div className={`p-4 border-t ${isDarkMode ? 'border-teal-600' : 'border-teal-500'} space-y-3`}>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition ${isDarkMode ? 'bg-teal-800 hover:bg-teal-700 text-yellow-300' : 'bg-teal-500 hover:bg-teal-600 text-white'}`}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              {isDarkMode ? t("light") : t("dark")}
            </button>
            <button onClick={openManageProfile} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition">
              <User size={18} /> {t("profile")}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className={`flex-1 flex flex-col h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-[#F8FAFC]'} transition`}>
          <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-8 py-4 flex justify-between items-center shadow-sm transition`}>
            <div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t("nearby_title")}</h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t("nearby_subtitle")}</p>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`rounded-2xl p-5 border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="space-y-4">
                  <button onClick={handleUseLocation} className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
                    {t("use_location")}
                  </button>
                  {nearbyLocationLabel && (
                    <div className={`text-xs rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-blue-900/20 border-blue-700 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                      Current location: {nearbyLocationLabel}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className={`block text-xs font-bold uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t("search_place")}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={placeQuery}
                        onChange={(e) => setPlaceQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePlaceSearch()}
                        placeholder={t("search_place_placeholder")}
                        className={`flex-1 px-3 py-2 rounded-xl border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-500'}`}
                      />
                      <button
                        onClick={handlePlaceSearch}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold transition ${isDarkMode ? 'bg-blue-700 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        disabled={placeLoading}
                      >
                        {placeLoading ? t("searching") : t("search_place")}
                      </button>
                    </div>
                    {!!placeResults.length && (
                      <div className={`max-h-40 overflow-y-auto rounded-xl border ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-white'}`}>
                        {placeResults.map((p, idx) => (
                          <button
                            key={`${p.display_name}-${idx}`}
                            onClick={() => handlePickPlace(p)}
                            className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 transition ${isDarkMode ? 'border-gray-600 text-gray-100 hover:bg-gray-600' : 'border-gray-100 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <div className="font-semibold">{p.display_name}</div>
                            <div className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {t("pick_location")} ({Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)})
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      value={manualCoords.lat}
                      onChange={(e) => setManualCoords((prev) => ({ ...prev, lat: e.target.value }))}
                      placeholder={t("latitude")}
                      className={`w-full px-3 py-2 rounded-xl border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-500'}`}
                    />
                    <input
                      type="number"
                      step="any"
                      value={manualCoords.lng}
                      onChange={(e) => setManualCoords((prev) => ({ ...prev, lng: e.target.value }))}
                      placeholder={t("longitude")}
                      className={`w-full px-3 py-2 rounded-xl border text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-500'}`}
                    />
                  </div>
                  <button
                    onClick={handleManualNearbySearch}
                    className={`w-full px-4 py-2 rounded-xl font-semibold transition ${isDarkMode ? 'bg-teal-700 text-white hover:bg-teal-600' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                  >
                    {t("find_shops")}
                  </button>
                  {nearbyError && (
                    <div className={`text-xs rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-amber-900/30 border-amber-700 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                      {nearbyError}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={nearbyPolling}
                      onChange={(e) => setNearbyPolling(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className={isDarkMode ? "text-gray-300" : "text-gray-600"}>Auto refresh nearby shops</span>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {nearbyLoading ? (
                    <div className="text-sm text-gray-500">{t("nearby_loading")}</div>
                  ) : nearbyShops.length === 0 ? (
                    <div className="text-sm text-gray-500">{t("no_shops")}</div>
                  ) : (
                    nearbyShops.map((shop, idx) => (
                      <div key={`${shop.id}-${idx}`} className={`p-3 rounded-xl border ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-100 bg-gray-50'}`}>
                        <div className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{shop.name}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{shop.address}</div>
                        {shop.distance_km != null && (
                          <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{t("distance")}: {shop.distance_km.toFixed(2)} km</div>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <button
                            onClick={() => handleRouteTo(shop)}
                            className={`${isDarkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-600'} hover:underline`}
                          >
                            {t("closest_route")}
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`${isDarkMode ? "text-emerald-300 hover:text-emerald-200" : "text-emerald-700 hover:text-emerald-600"} hover:underline`}
                          >
                            Open in Google Maps
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className={`w-full h-[70vh] rounded-2xl border overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div ref={mapContainerRef} className="w-full h-full" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (view === "dashboard") {
    const pendingOrders = liveOrders.filter((o) => o.status === "pending").length;
    const completedOrders = liveOrders.filter((o) => o.status === "completed").length;
    const cancelledOrders = liveOrders.filter((o) => o.status === "cancelled").length;
    const openPharmacies = liveNearby.filter((s) => s.isOpen).length;
    const dashboardNearbyShops = nearbyShops.length ? buildLiveNearby(nearbyShops) : liveNearby;

    const latestOrderName =
      orderHistory[0]?.product_name || orderHistory[0]?.["Product Name"] || liveOrders[0]?.name || "your last medicine";

    const smartNotifications = [
      ...liveOrders
        .filter((o) => o.status === "pending")
        .slice(0, 2)
        .map((o) => `${o.name} is pending confirmation.`),
      openPharmacies > 0 ? "Nearest pharmacy is open and ready." : "Checking pharmacy availability near you.",
    ].slice(0, 3);

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const ordersByWeek = Array.from({ length: 7 }, (_, offset) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - offset));
      const key = d.toISOString().slice(0, 10);
      const ordersForDay = orderHistory.filter((item) => {
        const dt = parseOrderDate(
          item?.created_at || item?.purchase_date || item?.["Purchase date"] || item?.date
        );
        return dt ? dt.toISOString().slice(0, 10) === key : false;
      });
      const orderCount = ordersForDay.length;
      const quantitySum = ordersForDay.reduce(
        (sum, item) => sum + Number(item?.quantity || item?.["Quantity"] || 1),
        0
      );
      return {
        day: dayLabels[d.getDay()],
        orders: orderCount,
        usage: quantitySum,
      };
    });
    const usageByWeek = ordersByWeek.map((d) => d.usage);

    const statusClass = (status) => {
      if (status === "completed") return "status-completed";
      if (status === "cancelled") return "status-cancelled";
      return "status-pending";
    };
    const applyFilter = (value) => {
      setOrdersFilter((prev) => (prev === value ? "all" : value));
    };

    const filteredOrders = liveOrders.filter((order) => {
      if (ordersFilter === "all") return true;
      return order.status === ordersFilter;
    });

    return (
      <div className={`dashboard-shell ${isDarkMode ? "dash-dark" : ""}`}>
        <div className="dash-layout">
          <aside className="dashboard-sidebar glass-card strong">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <Pill size={22} />
              </div>
              <div>
                <div className="sidebar-title">{t("app_name")}</div>
                <div className="sidebar-subtitle">Smart patient dashboard</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button className="nav-link active" onClick={() => goToView("dashboard")}>
                <Home size={18} /> {t("dashboard")}
              </button>
              <button className="nav-link" onClick={() => goToView("chat")}>
                <Bot size={18} /> {t("chat")}
              </button>
              <button className="nav-link" onClick={() => goToView("products")}>
                <ShoppingCart size={18} /> {t("products")}
              </button>
              <button className="nav-link" onClick={() => goToView("orders")}>
                <Package size={18} /> Orders
              </button>
              <button className="nav-link" onClick={() => goToView("book_appointment")}>
                <Calendar size={18} /> Book Appointment
              </button>
            </nav>

            <div className="sidebar-footer">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="pill-btn"
              >
                {isDarkMode ? t("light") : t("dark")}
              </button>
              <button
                onClick={openManageProfile}
                className="pill-btn primary"
              >
                Manage Profile
              </button>
            </div>
          </aside>

          <div className="dash-main">
            <header className="dash-topbar glass-card strong">
              <div>
                <div className="topbar-kicker">{t("dashboard")}</div>
                <div className="topbar-title">
                  {t("welcome_back", { name: user?.name || t("pharmacist") })}
                </div>
                <div className="topbar-sub">{t("dashboard_subtitle")}</div>
              </div>
              <div className="topbar-actions">
                <button
                  className="pill-btn primary"
                  onClick={() => {
                    goToView("chat");
                    handleSend(`Reorder ${latestOrderName}`);
                  }}
                >
                  <ShoppingCart size={16} /> Reorder Last
                </button>
                <button className="pill-btn" onClick={() => goToView("history")}>
                  <Paperclip size={16} /> View Prescription
                </button>
                <button className="pill-btn" onClick={() => goToView("book_appointment")}>
                  <Calendar size={16} /> Book Appointment
                </button>
                <div className="icon-btn">
                  <Bell size={18} />
                </div>
              </div>
            </header>

            <main className="pr-1">
            <section className="smart-cards fade-in">
              <div
                className={`glass-card stat-card clickable ${ordersFilter === "pending" ? "active" : ""}`}
                onClick={() => applyFilter("pending")}
              >
                <h4>Pending Orders</h4>
                <div className="stat-value">{pendingOrders}</div>
                <div className="chip mt-2">Tap to filter</div>
              </div>
              <div
                className={`glass-card stat-card clickable ${ordersFilter === "completed" ? "active" : ""}`}
                onClick={() => applyFilter("completed")}
              >
                <h4>Completed Orders</h4>
                <div className="stat-value">{completedOrders}</div>
                <div className="chip mt-2">Tap to filter</div>
              </div>
              <div
                className={`glass-card stat-card clickable ${ordersFilter === "cancelled" ? "active" : ""}`}
                onClick={() => applyFilter("cancelled")}
              >
                <h4>Cancelled Orders</h4>
                <div className="stat-value">{cancelledOrders}</div>
                <div className="chip mt-2">Tap to filter</div>
              </div>
              <div
                className="glass-card stat-card clickable"
                onClick={() => goToView("nearby")}
              >
                <h4>Nearby Pharmacies</h4>
                <div className="stat-value">{openPharmacies}</div>
                <div className="chip mt-2">Open map</div>
              </div>
            </section>

            <section className="section-grid fade-in" id="dash-orders">
              <div className="glass-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="section-title">Real-Time Orders</div>
                    <div className="section-sub">Auto-updates status and timestamps.</div>
                  </div>
                  <div className="chip">
                    {ordersFilter === "all" ? "All orders" : `${ordersFilter} orders`}
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {filteredOrders.length === 0 ? (
                    <div className="order-item text-slate-500">No orders in this filter.</div>
                  ) : (
                    filteredOrders.map((order) => (
                      <div key={order.id} className="order-item">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{order.name}</div>
                          <span className={`status-badge ${statusClass(order.status)}`}>{order.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Qty: {order.quantity}</span>
                          <span className="text-slate-500">{timeAgo(order.updatedAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </section>

            <section className="section-grid fade-in">
              <div className="glass-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="section-title">Nearby Pharmacies</div>
                    <div className="section-sub">Live open/closed and stock updates.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="pill-btn" onClick={handleUseLocation}>
                      Use my location
                    </button>
                    <button className="pill-btn" onClick={() => goToView("nearby")}>
                      Open map
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {nearbyLoading ? (
                    <div className={`order-item ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                      Finding nearby pharmacies...
                    </div>
                  ) : dashboardNearbyShops.length === 0 ? (
                    <div className={`order-item ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                      Use your location to load nearby pharmacy names and location links.
                    </div>
                  ) : (
                    dashboardNearbyShops.map((shop) => (
                      <div key={shop.id} className="nearby-item">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{shop.name}</div>
                            <div className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                              {shop.address || "Location details unavailable"}
                            </div>
                          </div>
                          <span className="chip">{shop.isOpen ? "Open" : "Closed"}</span>
                        </div>
                        <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-600"}`}>
                          <span>{shop.distanceKm} km away</span>
                          <span>{shop.stock}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {shop.mapUrl && (
                            <a
                              href={shop.mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`pill-btn ${isDarkMode ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : ""}`}
                            >
                              Open location
                            </a>
                          )}
                          <button className="pill-btn" onClick={() => goToView("nearby")}>
                            Open map view
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="section-title">Mini Analytics</div>
                    <div className="section-sub">Orders per week and medicine usage.</div>
                  </div>
                  <div className="chip">Live analytics</div>
                </div>

                <div className="mt-5">
                  <div className="text-sm font-semibold mb-2">Orders per week</div>
                  <div className="mini-chart labeled">
                    {ordersByWeek.map((item, idx) => (
                      <div key={`order-${idx}`} className="mini-bar-wrap" title={`${item.day}: ${item.orders} orders`}>
                        <div className="mini-bar-value">{item.orders}</div>
                        <div className="mini-bar" style={{ height: `${item.orders * 5}px` }} />
                        <div className="mini-bar-label">{item.day}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2">Medicine usage</div>
                  <div className="mini-chart">
                    {usageByWeek.map((v, idx) => (
                      <div key={`use-${idx}`} className="mini-bar alt" style={{ height: `${v * 2}px` }} />
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2">Smart Notifications</div>
                  <div className="grid gap-2 text-sm text-slate-500">
                    {smartNotifications.map((note, idx) => (
                      <div key={`note-${idx}`} className="order-item">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (view === "orders") {
    const totalOrders = liveOrders.length;
    const pendingOrders = liveOrders.filter((o) => o.status === "pending").length;
    const completedOrders = liveOrders.filter((o) => o.status === "completed").length;
    const cancelledOrders = liveOrders.filter((o) => o.status === "cancelled").length;

    const statusClass = (status) => {
      if (status === "completed") return "status-completed";
      if (status === "cancelled") return "status-cancelled";
      return "status-pending";
    };

    return (
      <div className={`dashboard-shell ${isDarkMode ? "dash-dark" : ""}`}>
        <div className="dash-layout">
          <aside className="dashboard-sidebar glass-card strong">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <Pill size={22} />
              </div>
              <div>
                <div className="sidebar-title">{t("app_name")}</div>
                <div className="sidebar-subtitle">Smart patient dashboard</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button className="nav-link" onClick={() => goToView("dashboard")}>
                <Home size={18} /> {t("dashboard")}
              </button>
              <button className="nav-link active" onClick={() => goToView("orders")}>
                <Package size={18} /> Orders
              </button>
              <button className="nav-link" onClick={() => goToView("products")}>
                <ShoppingCart size={18} /> {t("products")}
              </button>
              <button className="nav-link" onClick={() => goToView("chat")}>
                <Pill size={18} /> {t("chat")}
              </button>
            </nav>

            <div className="sidebar-footer">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="pill-btn">
                {isDarkMode ? t("light") : t("dark")}
              </button>
              <button onClick={openManageProfile} className="pill-btn primary">
                Manage Profile
              </button>
            </div>
          </aside>

          <div className="dash-main">
            <header className="dash-topbar glass-card strong">
              <div>
                <div className="topbar-kicker">Orders</div>
                <div className="topbar-title">Live Order List</div>
                <div className="topbar-sub">Track every order in real-time.</div>
              </div>
              <div className="topbar-actions">
                <button className="pill-btn" onClick={() => goToView("history")}>
                  <History size={16} /> View History
                </button>
                <button className="pill-btn primary" onClick={() => goToView("products")}>
                  <ShoppingCart size={16} /> New Order
                </button>
              </div>
            </header>

            <section className="smart-cards fade-in">
              <div className="glass-card stat-card">
                <h4>Total Orders</h4>
                <div className="stat-value">{totalOrders}</div>
                <div className="chip mt-2">Live count</div>
              </div>
              <div className="glass-card stat-card">
                <h4>Pending</h4>
                <div className="stat-value">{pendingOrders}</div>
                <div className="chip mt-2">Waiting</div>
              </div>
              <div className="glass-card stat-card">
                <h4>Completed</h4>
                <div className="stat-value">{completedOrders}</div>
                <div className="chip mt-2">Completed</div>
              </div>
              <div className="glass-card stat-card">
                <h4>Cancelled</h4>
                <div className="stat-value">{cancelledOrders}</div>
                <div className="chip mt-2">Cancelled</div>
              </div>
            </section>

            <section className="glass-card p-6 fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <div className="section-title">Order List</div>
                  <div className="section-sub">Statuses update instantly from Socket.IO.</div>
                </div>
                <div className="chip">Auto refresh</div>
              </div>

              <div className="mt-5 grid gap-3">
                {liveOrders.length === 0 ? (
                  <div className="order-item text-slate-500">No live orders yet.</div>
                ) : (
                  liveOrders.map((order) => (
                    <div key={order.id} className="order-item">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{order.name}</div>
                        <span className={`status-badge ${statusClass(order.status)}`}>{order.status}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <span>Qty: {order.quantity}</span>
                        <span>{timeAgo(order.updatedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: PRODUCTS PAGE
  // ==========================================
  if (view === "products") {
    const filtered = products.filter((p) =>
      !productSearch || (p.product_name || "").toLowerCase().includes(productSearch.toLowerCase())
    );

    return (
      <div className={`dashboard-shell ${isDarkMode ? "dash-dark" : ""}`}>
        <div className="dash-layout">
          <aside className="dashboard-sidebar glass-card strong">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <Pill size={22} />
              </div>
              <div>
                <div className="sidebar-title">{t("app_name")}</div>
                <div className="sidebar-subtitle">Smart patient dashboard</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => goToView("dashboard")}>
                <Home size={18} /> {t("dashboard")}
              </button>
              <button className={`nav-link ${view === 'chat' ? 'active' : ''}`} onClick={() => goToView("chat")}>
                <Bot size={18} /> {t("chat")}
              </button>
              <button className={`nav-link ${view === 'products' ? 'active' : ''}`} onClick={() => goToView("products")}>
                <ShoppingCart size={18} /> {t("products")}
              </button>
              <button className={`nav-link ${view === 'orders' ? 'active' : ''}`} onClick={() => goToView("orders")}>
                <Package size={18} /> Orders
              </button>
            </nav>

            <div className="sidebar-footer">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="pill-btn"
              >
                {isDarkMode ? t("light") : t("dark")}
              </button>
              <button
                onClick={openManageProfile}
                className="pill-btn primary"
              >
                Manage Profile
              </button>
            </div>
          </aside>

          <div className="dash-main">
            <header className="dash-topbar glass-card strong">
              <div>
                <div className="topbar-kicker">{t("products")}</div>
                <div className="topbar-title">{t("shop_products")}</div>
                <div className="topbar-sub">{t("shop_subtitle")}</div>
              </div>
              <div className="topbar-actions">
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t("search_products")}
                  className="px-4 py-2 rounded-xl text-sm bg-white/10 border border-white/20 text-white placeholder-white/50"
                />
              </div>
            </header>

            <main className="glass-card p-6 overflow-y-auto">
              <div className="max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{t("all_products")}</h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t("all_products_subtitle")}</p>
                </div>
                <div className="w-full sm:w-96">
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={t("search_products")}
                    className={`w-full rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 transition ${isDarkMode ? 'bg-gray-800 border border-gray-700 text-white focus:ring-blue-600 focus:border-blue-600' : 'bg-white border border-gray-200 text-gray-700 focus:ring-blue-500 focus:border-blue-500'}`}
                  />
                </div>
              </div>

            {productsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="text-blue-600 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className={`text-center py-20 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>{t("no_results")}</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p, idx) => (
                  <div key={idx} className={`rounded-3xl p-5 shadow-sm hover:shadow-md transition border ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-blue-600' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-start justify-between">
                      <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{p.product_name}</h3>
                      <span className="text-sm font-bold text-blue-600">₹{formatPrice(p.price)}</span>
                    </div>
                    <p className={`text-sm mt-2 line-clamp-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{getProductDescription(p)}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        onClick={() => {
                          goToView("chat");
                          handleSend(`Order 1 ${p.product_name}`);
                        }}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                      >
                        {t("order_now")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: HISTORY PAGE
  // ==========================================
  if (view === "history") {
    const historyView = (
      <div className={`flex h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-[#F8FAFC]'} transition`}>
        {/* LEFT SIDEBAR */}
        <aside className={`w-64 ${isDarkMode ? 'bg-teal-700' : 'bg-teal-600'} text-white flex flex-col shadow-xl transition`}>
          <div className={`p-6 border-b ${isDarkMode ? 'border-teal-600' : 'border-teal-500'} flex items-center gap-3`}>
            <Pill size={28} className="text-teal-200" />
            <h1 className="text-2xl font-bold tracking-wide">{t("app_name")}</h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <button 
              onClick={() => goToView("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'dashboard' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}
            >
              <Home size={20} className={view === 'dashboard' ? 'text-white' : 'text-teal-200'} /> {t("dashboard")}
            </button>
            <button 
              onClick={() => goToView("chat")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'chat' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}
            >
              <Pill size={20} className={view === 'chat' ? 'text-white' : 'text-teal-200'} /> {t("chat")}
            </button>
            <button 
              onClick={() => goToView("products")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'products' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}
            >
              <ShoppingCart size={20} className={view === 'products' ? 'text-white' : 'text-teal-200'} /> {t("products")}
            </button>
            <button 
              onClick={() => goToView("orders")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${view === 'orders' ? `${isDarkMode ? 'bg-teal-800 shadow-inner' : 'bg-teal-500 shadow-inner'}` : 'hover:bg-teal-600'}`}
            >
              <Package size={20} className={view === 'orders' ? 'text-white' : 'text-teal-200'} /> Orders
            </button>
          </nav>

          {/* Theme Toggle */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-teal-600' : 'border-teal-500'} space-y-3`}>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition ${isDarkMode ? 'bg-teal-800 hover:bg-teal-700 text-yellow-300' : 'bg-teal-500 hover:bg-teal-600 text-white'}`}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              {isDarkMode ? t("light") : t("dark")}
            </button>
            <button
              onClick={openManageProfile}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition"
            >
            <User size={18} /> {t("profile")}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className={`flex-1 flex flex-col h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-[#F8FAFC]'} transition`}>
          {/* TOP HEADER */}
          <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-8 py-6 shadow-sm transition`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>📦 {t("history_title")}</h2>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t("history_subtitle")}</p>
              </div>
            </div>
          </header>

          <main className={`flex-1 overflow-y-auto px-6 py-8 ${isDarkMode ? 'bg-gray-900' : 'bg-[#F8FAFC]'} transition`}>
            <div className="max-w-4xl mx-auto">
              {loadingHistory ? (
                <div className="flex justify-center py-20">
                  <Loader2 size={40} className="text-blue-600 animate-spin" />
                </div>
                
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Package size={64} className="mx-auto mb-4 opacity-20" />
                  <p>{t("no_history")}</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {orderHistory.map((item, index) => {
                    const productName = item["Product Name"] || item.product_name || t("unknown_product");
                    const quantity = item["Quantity"] || item.quantity || "-";
                    const dosage = item["Dosage frequency"] || item.dosage_frequency || t("not_available");
                    const orderId = item.order_id || item["Order ID"];
                    const statusRaw = item.status || item["Status"] || "completed";
                    const status = String(statusRaw).toLowerCase();
                    const isCancelled = status === "cancelled";

                    const rawDate = item["Purchase date"] || item.created_at || item.purchase_date;
                    let dateStr = t("unknown_date");
                    let timeStr = "";
                    
                    if (rawDate) {
                      try {
                      let parsedDateStr = rawDate;
                      if (typeof rawDate === 'string' && rawDate.includes(' ') && !rawDate.includes('T')) {
                        parsedDateStr = rawDate.replace(' ', 'T');
                        if (!parsedDateStr.endsWith('Z')) parsedDateStr += 'Z';
                      }
                      const d = new Date(parsedDateStr);
                      if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      } else {
                        dateStr = rawDate;
                      }
                    } catch {
                      dateStr = rawDate;
                    }
                  }

                  const productInfo = products.find((p) => (p.product_name || "").toLowerCase() === (productName || "").toLowerCase());
                  const price = productInfo?.price;
                  const description = productInfo?.description;

                  return (
                    <div key={index} className={`p-5 rounded-2xl border flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:shadow-md transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:border-blue-700' : 'bg-white border-gray-100'}`}>
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl text-blue-600 ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                          <Package size={24} />
                        </div>
                        <div>
                          <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{productName}</h3>
                          {price !== undefined && price !== null && (
                            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t("price_label")}: ₹{formatPrice(price)}</p>
                          )}
                          {description && (
                            <p className={`text-sm mt-2 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
                            <span className={`flex items-center gap-1 font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <Calendar size={14}/> 
                              {dateStr} {timeStr && `• ${timeStr}`}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>{t("qty_label")}: {quantity}</span>
                          </div>
                          <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{t("dosage_label")}: {dosage}</p>
                        </div>
                      </div>
                      
                      {/* Reminder & Status Actions */}
                      <div className="flex flex-col items-end gap-2">
                        <span className={`inline-block px-3 py-1 font-bold text-[10px] rounded-full border uppercase tracking-wide ${
                          isCancelled
                            ? "bg-red-50 text-red-600 border-red-200"
                            : "bg-green-50 text-green-600 border-green-200"
                        }`}>
                          {t("status_label")}: {isCancelled ? t("status_cancelled") : t("status_active")}
                        </span>
                        {!isCancelled && (
                          <button 
                            onClick={() => setReminderModal({ productName })}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                          >
                            <Clock size={14} /> {t("need_reminder")}
                          </button>
                        )}
                        {!isCancelled && orderId && (
                          <button
                            onClick={() => handleCancelOrder(orderId)}
                            disabled={cancellingOrderId === orderId}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-all ${
                              cancellingOrderId === orderId
                                ? "bg-gray-400 text-white"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            {cancellingOrderId === orderId ? t("cancelling") : t("cancel_order")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </main>
        </div>
      </div>
    );
    
    return (
      <>
        {historyView}
        {/* ===================== REMINDER MODAL ===================== */}
        {reminderModal && (
          <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in transition ${isDarkMode ? 'bg-black/60' : 'bg-black/50'}`}>
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all zoom-in-95`}>
              
              <div className={`${isDarkMode ? 'bg-blue-700 border-blue-500' : 'bg-blue-600 border-blue-400'} px-6 py-5 flex justify-between items-center text-white border-b`}>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Clock size={20} /> Set WhatsApp Reminder
                  </h3>
                  <p className="text-xs mt-1 truncate max-w-[250px] text-blue-50">
                    For: {reminderModal.productName}
                  </p>
                </div>
                <button onClick={() => setReminderModal(null)} className="text-white/90 hover:text-white transition bg-black/35 hover:bg-black/45 rounded-xl p-2">
                  <X size={24} />
                </button>
              </div>

              <div className={`p-6 space-y-5 ${isDarkMode ? 'bg-gray-800' : ''}`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>
                  When do you want us to remind you to take or re-order this medicine via WhatsApp?
                </p>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className={`block text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-500'}`}>Days</label>
                    <input 
                      type="number" min="0"
                      value={reminderForm.days}
                      onChange={(e) => setReminderForm({...reminderForm, days: e.target.value})}
                      className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition ${isDarkMode ? 'bg-gray-700 border border-gray-500 text-white placeholder-gray-300 focus:ring-blue-400' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-blue-500'}`}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={`block text-xs font-bold uppercase mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-500'}`}>Hours</label>
                    <input 
                      type="number" min="0" max="23"
                      value={reminderForm.hours}
                      onChange={(e) => setReminderForm({...reminderForm, hours: e.target.value})}
                      className={`w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition ${isDarkMode ? 'bg-gray-700 border border-gray-500 text-white placeholder-gray-300 focus:ring-blue-400' : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-500 focus:ring-blue-500'}`}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSetReminder}
                  disabled={reminderLoading}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 text-white font-bold rounded-xl transition shadow-lg ${isDarkMode ? 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'} disabled:opacity-70`}
                >
                  {reminderLoading ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                  {reminderLoading ? "Scheduling..." : "Confirm Reminder"}
                </button>
              </div>

            </div>
          </div>
        )}
      </>
    );
  }

  if (view === "report_chat") {
    return (
      <div className={`dashboard-shell ${isDarkMode ? "dash-dark" : ""}`}>
        <div className="dash-layout">
          <aside className="dashboard-sidebar glass-card strong">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <Pill size={22} />
              </div>
              <div>
                <div className="sidebar-title">{t("app_name")}</div>
                <div className="sidebar-subtitle">Smart patient dashboard</div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => goToView("dashboard")}>
                <Home size={18} /> {t("dashboard")}
              </button>
              <button className={`nav-link ${view === 'chat' ? 'active' : ''}`} onClick={() => goToView("chat")}>
                <Bot size={18} /> {t("chat")}
              </button>
              <button className={`nav-link ${view === 'report_chat' ? 'active' : ''}`} onClick={() => goToView("report_chat")}>
                <FileText size={18} /> {t("report_analysis")}
              </button>
              <button className={`nav-link ${view === 'products' ? 'active' : ''}`} onClick={() => goToView("products")}>
                <ShoppingCart size={18} /> {t("products")}
              </button>
              <button className={`nav-link ${view === 'orders' ? 'active' : ''}`} onClick={() => goToView("orders")}>
                <Package size={18} /> Orders
              </button>
            </nav>

            <div className="sidebar-footer">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="pill-btn">
                {isDarkMode ? t("light") : t("dark")}
              </button>
              <button onClick={openManageProfile} className="pill-btn primary">
                Manage Profile
              </button>
            </div>
          </aside>

          <div className="dash-main">
            <header className="dash-topbar chat-topbar glass-card strong">
              <div>
                <div className="topbar-kicker">{t("report_analysis")}</div>
                <div className="topbar-title">{t("report_chat_title")}</div>
                <div className="topbar-sub">{t("report_chat_subtitle")}</div>
              </div>
              <div className="topbar-actions">
                <button
                  className="pill-btn"
                  onClick={() => {
                    setReportSessionId(null);
                    setReportMessages([
                      {
                        role: "bot",
                        text: "Upload a medical report and ask questions. I will answer only from the report details.",
                      },
                    ]);
                  }}
                >
                  <Trash2 size={16} /> Clear
                </button>
              </div>
            </header>

            <main className="glass-card chat-main p-4 overflow-y-auto">
              <div className="max-w-5xl mx-auto space-y-6">
                {reportMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`flex gap-3 max-w-[92%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                        ${msg.role === "user" ? "bg-blue-600 text-white" : isDarkMode ? "bg-teal-700 border border-teal-600 text-teal-100" : "bg-white border border-gray-200 text-blue-600"}`}>
                        {msg.role === "user" ? <User size={20} /> : <Bot size={20} />}
                      </div>
                      <div
                        className={`p-5 rounded-3xl shadow-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : isDarkMode ? "bg-gray-700 text-white border border-gray-600 rounded-tl-none" : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                        }`}
                      >
                        {msg.text && (
                          <div className={`prose prose-sm max-w-none ${msg.role === "user" ? "chat-prose-user" : "chat-prose-bot"}`}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        )}
                        {msg.image && (
                          <img src={msg.image} alt="uploaded report" className="mt-3 rounded-xl max-w-xs border" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {reportLoading && (
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                      <Loader2 size={20} className="text-blue-600 animate-spin" />
                    </div>
                    <div className="text-sm text-gray-400 font-medium animate-pulse">{t("consulting_db")}</div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </main>

            <footer className="glass-card chat-composer p-4">
              <div className="max-w-5xl mx-auto space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => reportFileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-sm ${isDarkMode ? 'bg-gray-700 border border-emerald-600 text-emerald-400 hover:bg-gray-600' : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                  >
                    <FileText size={14} /> {t("report_analysis")}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>{t("report_language_label")}</span>
                    <select
                      value={reportChatLanguage}
                      onChange={(e) => setReportChatLanguage(e.target.value)}
                      className={`rounded-xl px-3 py-2 text-sm border ${isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-800"}`}
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="mr">Marathi</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    ref={reportFileInputRef}
                    onChange={handleReportUpload}
                    style={{ display: "none" }}
                  />
                  <div className="relative flex-1">
                    <input
                      className={`w-full px-6 py-5 pr-16 rounded-3xl focus:outline-none focus:ring-4 transition shadow-inner ${isDarkMode ? 'bg-gray-700 border border-gray-600 text-white focus:ring-blue-900/30 focus:bg-gray-600 focus:border-blue-700 placeholder-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-700 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500'}`}
                      value={reportInput}
                      onChange={(e) => setReportInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendReportQuestion()}
                      placeholder={t("report_question_placeholder")}
                    />
                    <button
                      onClick={() => handleSendReportQuestion()}
                      className="absolute right-3 top-3 p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:bg-gray-300"
                      disabled={reportLoading}
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: CHAT PAGE
  // ==========================================
  return (
    <div className={`dashboard-shell ${isDarkMode ? "dash-dark" : ""}`}>
      <div className="dash-layout">
        <aside className="dashboard-sidebar glass-card strong">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <Pill size={22} />
            </div>
            <div>
              <div className="sidebar-title">{t("app_name")}</div>
              <div className="sidebar-subtitle">Smart patient dashboard</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => goToView("dashboard")}>
              <Home size={18} /> {t("dashboard")}
            </button>
            <button className={`nav-link ${view === 'chat' ? 'active' : ''}`} onClick={() => goToView("chat")}>
              <Bot size={18} /> {t("chat")}
            </button>
            <button className={`nav-link ${view === 'report_chat' ? 'active' : ''}`} onClick={() => goToView("report_chat")}>
              <FileText size={18} /> {t("report_analysis")}
            </button>
            <button className={`nav-link ${view === 'products' ? 'active' : ''}`} onClick={() => goToView("products")}>
              <ShoppingCart size={18} /> {t("products")}
            </button>
            <button className={`nav-link ${view === 'orders' ? 'active' : ''}`} onClick={() => goToView("orders")}>
              <Package size={18} /> Orders
            </button>
          </nav>

          <div className="sidebar-footer">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="pill-btn"
            >
              {isDarkMode ? t("light") : t("dark")}
            </button>
            <button
              onClick={openManageProfile}
              className="pill-btn primary"
            >
              Manage Profile
            </button>
          </div>
        </aside>

        <div className="dash-main">
          <header className="dash-topbar chat-topbar glass-card strong">
            <div>
              <div className="topbar-kicker">{t("chat")}</div>
              <div className="topbar-title">{t("chat_title")}</div>
              <div className="topbar-sub">{t("chat_subtitle")}</div>
            </div>
            <div className="topbar-actions">
              <button className="pill-btn" onClick={() => setMessages([messages[0]])}>
                <Trash2 size={16} /> Clear
              </button>
            </div>
          </header>

          <main className="glass-card chat-main p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`flex gap-3 max-w-[92%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm
                      ${msg.role === "user" ? "bg-blue-600 text-white" : isDarkMode ? "bg-teal-700 border border-teal-600 text-teal-100" : "bg-white border border-gray-200 text-blue-600"}`}>
                      {msg.role === "user" ? <User size={20} /> : <Bot size={20} />}
                    </div>
                <div
                 className={`p-5 rounded-3xl shadow-sm leading-relaxed ${
                    msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : isDarkMode ? "bg-gray-700 text-white border border-gray-600 rounded-tl-none" : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
  }`}
>
                 {/* Render Markdown Text */}
                 {msg.text && (
                   <div className={`prose prose-sm max-w-none ${msg.role === "user" ? "chat-prose-user" : "chat-prose-bot"}`}>
                     <ReactMarkdown>{msg.text}</ReactMarkdown>
                   </div>
  )}
                 
                 {/* Render Uploaded Image */}
                 {msg.image && (
                   <img
                      src={msg.image}
                      alt="uploaded"
                      className="mt-3 rounded-xl max-w-xs border"
    />
  )}
</div>
              </div>

              {/* 🧾 NEW: BEAUTIFUL BILL RECEIPT UI */}
              {msg.receipt && (
                <div className="mt-4 w-full min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-gray-800">
                  <div className="bg-blue-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-blue-800 flex items-center gap-2">
                      <Package size={16} /> Bill Receipt
                    </span>
                    <span className="text-xs text-blue-500 font-mono font-bold tracking-wider">
                      #{String(msg.receipt.order_id ?? "").split("-")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 flex items-center gap-2"><UserCircle size={14} /> Name</span>
                      <span className="font-semibold">{msg.receipt.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 flex items-center gap-2"><Phone size={14} /> Phone</span>
                      <span className="font-semibold">{msg.receipt.phone}</span>
                    </div>
                    
                    <div className="w-full h-px bg-gray-100 my-2"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 flex items-center gap-2"><Pill size={14} /> Medicine</span>
                      <span className="font-semibold max-w-[150px] truncate" title={msg.receipt.medicine}>
                        {msg.receipt.medicine}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Quantity</span>
                      <span className="font-bold">{msg.receipt.quantity} units</span>
                    </div>
                    {msg.receipt.delivery_location && (
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-gray-500 flex items-center gap-2"><Map size={14} /> Delivery</span>
                        <div className="text-right">
                          <div className="font-semibold max-w-[220px] break-words">{msg.receipt.delivery_location}</div>
                          {msg.receipt.delivery_map_url && (
                            <a
                              href={msg.receipt.delivery_map_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Open location
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 px-4 py-4 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Total Amount</span>
                    <span className="font-black text-xl text-teal-600">${Number(msg.receipt.total).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 items-center">
              <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <Loader2 size={20} className="text-blue-600 animate-spin" />
              </div>
              <div className="text-sm text-gray-400 font-medium animate-pulse">{t("consulting_db")}</div>
            </div>
          )}
          <div ref={messagesEndRef} />
            </div>
          </main>

          {/* FOOTER / INPUT */}
          <footer className="glass-card chat-composer p-4">
            <div className="max-w-5xl mx-auto">
          <div className="flex gap-3 mb-4">
            <button onClick={fetchAlerts} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-sm ${isDarkMode ? 'bg-gray-700 border border-orange-600 text-orange-400 hover:bg-gray-600' : 'bg-white border border-orange-200 text-orange-600 hover:bg-orange-50'}`}>
              <Bell size={14} /> {t("refill_alerts")}
            </button>
            <button onClick={() => goToView("report_chat")} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-sm ${isDarkMode ? 'bg-gray-700 border border-emerald-600 text-emerald-400 hover:bg-gray-600' : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
              <FileText size={14} /> {t("report_analysis")}
            </button>
            <button onClick={() => handleSend(t("order_paracetamol_command"))} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition shadow-sm ${isDarkMode ? 'bg-gray-700 border border-blue-600 text-blue-400 hover:bg-gray-600' : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
              <PlusCircle size={14} /> {t("order_paracetamol")}
            </button>
          </div>

          <div className="flex items-center gap-3 relative group">
            {/* ✅ MICROPHONE BUTTON */}
            <button 
              onClick={toggleMic}
              title={isVoiceAssistantOn ? "Voice Assistant ON" : "Voice Assistant OFF"}
              className={`p-4 rounded-2xl transition-all shadow-md flex items-center justify-center ${
                isVoiceAssistantOn || isListening
                ? "bg-red-500 text-white animate-pulse shadow-red-200" 
                : isDarkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-blue-400" : "bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
              }`}
            >
              <Mic size={22} />
            </button>
            <button
              onClick={() => {
                if (isVoiceAssistantOn) {
                  setIsSpeakerOn(true);
                  return;
                }
                setIsSpeakerOn((prev) => {
                  const next = !prev;
                  if (next && !hasSpokenTestRef.current) {
                    hasSpokenTestRef.current = true;
                    setTimeout(() => {
                      speakBotText("Speaker is on. I can reply by voice now.", preferredLanguage);
                    }, 120);
                  }
                  return next;
                });
              }}
              title={isSpeakerOn ? "Speaker ON" : "Speaker OFF"}
              className={`p-4 rounded-2xl transition-all shadow-md flex items-center justify-center ${
                isSpeakerOn
                  ? "bg-green-600 text-white shadow-green-200"
                  : isDarkMode
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-green-400"
                  : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600"
              }`}
            >
              {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
            <button
              onClick={() => fileInputRef.current.click()}
              className={`p-4 rounded-2xl shadow-md ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-blue-400' : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}
              >
                <Paperclip size={22} />
            </button>

<input
  type="file"
  accept="image/*"
  ref={fileInputRef}
  onChange={handleImageUpload}
  style={{ display: "none" }}
/>
<input
  type="file"
  accept="image/*"
  ref={reportFileInputRef}
  onChange={handleReportUpload}
  style={{ display: "none" }}
/>
            <div className="relative flex-1">
              <input
                className={`w-full px-6 py-5 pr-16 rounded-3xl focus:outline-none focus:ring-4 transition shadow-inner ${isDarkMode ? 'bg-gray-700 border border-gray-600 text-white focus:ring-blue-900/30 focus:bg-gray-600 focus:border-blue-700 placeholder-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-700 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500'}`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={isListening ? t("listening_placeholder") : t("input_placeholder")}
              />
              <button 
                onClick={() => handleSend()}
                className="absolute right-3 top-3 p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:bg-gray-300"
                disabled={loading}
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </footer>

        </div>
      </div>

      {/* ===================== PROFILE MODAL ===================== */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4" onClick={() => setShowProfileModal(false)}>
          <div className={`${isDarkMode ? "bg-slate-900 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-200"} max-w-md w-full rounded-2xl border p-6 shadow-xl`} onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-1">{t("profile_title")}</h2>
            <p className={`text-sm mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Update your account details and preferred language.</p>
            <div className="space-y-4">
              {profileError && (
                <div className={`rounded-xl px-3 py-2 text-sm ${isDarkMode ? "bg-red-950/60 text-red-200 border border-red-900" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className={`rounded-xl px-3 py-2 text-sm ${isDarkMode ? "bg-emerald-950/60 text-emerald-200 border border-emerald-900" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                  {profileSuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t("name")}</label>
                <input value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} placeholder={t("name")} className={`w-full px-3 py-2 border rounded-xl ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-300 text-black"}`} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("phone_number")}</label>
                <input value={profileData.phone} onChange={(e) => setProfileData({...profileData, phone: e.target.value})} placeholder={t("phone_number")} className={`w-full px-3 py-2 border rounded-xl ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-300 text-black"}`} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("language")}</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl ${isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-black"}`}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowProfileModal(false)} className={`flex-1 px-4 py-2 rounded-xl ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-gray-200 hover:bg-gray-300 text-slate-900"}`}>{t("close")}</button>
                <button onClick={handleProfileSave} disabled={profileSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60">{profileSaving ? "Saving..." : t("save")}</button>
                <button onClick={() => { setShowProfileModal(false); performLogout(); }} className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700">{t("logout")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderLocationModal.open && (
        <div className="fixed inset-0 z-[2100] bg-black/50 flex items-center justify-center p-4" onClick={closeOrderLocationModal}>
          <div
            className={`${isDarkMode ? "bg-slate-900 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-200"} max-w-lg w-full rounded-2xl border p-6 shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold">Delivery Location</h2>
            <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Share the delivery location before confirming your order for {orderLocationModal.quantity} unit(s) of {orderLocationModal.productName || "this medicine"}.
            </p>
            {orderLocationModal.error && (
              <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${isDarkMode ? "bg-red-950/60 text-red-200 border border-red-900" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {orderLocationModal.error}
              </div>
            )}
            <div className="mt-4 space-y-4">
              <button
                onClick={handleUseLiveOrderLocation}
                type="button"
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700"
              >
                Use Live Location
              </button>
              {orderLocationModal.selectedLabel && (
                <div className={`rounded-xl px-3 py-3 text-sm border ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {orderLocationModal.selectedLabel}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Or enter delivery address manually</label>
                <textarea
                  rows="4"
                  value={orderLocationModal.manualAddress}
                  onChange={(e) => setOrderLocationModal((prev) => ({ ...prev, manualAddress: e.target.value, selectedLabel: "", mapUrl: "", error: "" }))}
                  placeholder="House no, street, area, city"
                  className={`w-full rounded-xl border px-4 py-3 ${isDarkMode ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={closeOrderLocationModal} className={`px-4 py-2 rounded-xl ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-900 hover:bg-slate-300"}`}>
                Cancel
              </button>
              <button
                onClick={submitOrderLocation}
                disabled={orderLocationModal.saving}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
              >
                {orderLocationModal.saving ? "Saving..." : "Confirm Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------------------------
// Admin dashboard component
// ---------------------------
// ---------------------------
// Admin dashboard component
// ---------------------------
// Add these to your lucide-react imports at the top:
// import { Edit2, Search, X, Save, ... } from "lucide-react";

// ---------------------------
// Admin dashboard component
// ---------------------------
function AdminView({ logout, t }) {
  const tt = t || ((key) => key);
  // Navigation State
  const [activeTab, setActiveTab] = useState("inventory"); // "inventory" | "orders" | "analysis"

  // Inventory States
  const [products, setProducts] = useState([]);
  const[filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [showCreateProductForm, setShowCreateProductForm] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    product_id: "",
    product_name: "",
    description: "",
    stock: 0,
    price: 0,
    prescription_required: false,
  });

  // Orders States
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchOrderQuery, setSearchOrderQuery] = useState("");
  const[loadingOrders, setLoadingOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [otpModal, setOtpModal] = useState({
    open: false,
    orderId: null,
    otp: "",
    error: ""
  });

  // Order Analytics States
  const [orderAnalytics, setOrderAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({ product_name: "", stock: 0, price: 0, prescription_required: false });
  const[savingAction, setSavingAction] = useState(false);

  const fileInputRef = useRef(null);

  // --- FETCH INVENTORY ---
  const fetchProducts = () => {
    setLoading(true);
    axios
      .get(`${API_BASE}/admin/products`)
      .then((res) => {
        const normalizedProducts = (res.data.products || []).map(p => ({
          id: p['product id'] || p.product_id,
          name: p['product name'] || p.product_name,
          stock: p.stock ?? p['stock'] ?? 0,
          price: p['price rec'] || p.price || 0,
          prescription: String(p.prescription ?? p['prescription_rec'] ?? p['prescription record'] ?? p['prescription_required'] ?? '').toLowerCase() === 'true'
        }));
        setProducts(normalizedProducts);
        setFilteredProducts(normalizedProducts);
        setAnalysis(res.data.analysis || null);
      })
      .catch((err) => console.error("admin fetch error", err))
      .finally(() => setLoading(false)); // Ensure proper closure of fetchProducts
  };

  // --- FETCH ORDERS ---
  const fetchOrders = () => {
    setLoadingOrders(true);
    axios
      .get(`${API_BASE}/admin/orders`)
      .then((res) => {
        // Sort orders so newest are at the top
        const sortedOrders = res.data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setOrders(sortedOrders);
        setFilteredOrders(sortedOrders);
      })
      .catch((err) => console.error("admin fetch orders error", err))
      .finally(() => setLoadingOrders(false)); // Ensure proper closure of fetchOrders
  };

  // --- FETCH ORDER ANALYTICS ---
  const fetchOrderAnalytics = () => {
    setLoadingAnalytics(true);
    axios
      .get(`${API_BASE}/admin/order-analytics`)
      .then((res) => {
        setOrderAnalytics(res.data);
      })
      .catch((err) => console.error("admin fetch analytics error", err))
      .finally(() => setLoadingAnalytics(false));
  };

  const openOtpModal = (orderId) => {
    if (!orderId) return;
    setOtpModal({
      open: true,
      orderId,
      otp: "",
      error: ""
    });
  };

  const closeOtpModal = () => {
    setOtpModal({
      open: false,
      orderId: null,
      otp: "",
      error: ""
    });
  };

  const updateAdminOrderStatus = async (orderId, status, otpCode = "") => {
    if (!orderId || !status) return;
    const payload = { status };

    if (String(status).toLowerCase() === "completed") {
      const otp = String(otpCode || "").trim();
      if (!/^\d{6}$/.test(otp)) {
        setOtpModal((prev) => ({ ...prev, error: "Please enter a valid 6-digit OTP." }));
        return;
      }
      payload.otp = otp;
    }

    setUpdatingOrderId(orderId);
    try {
      const res = await axios.put(`${API_BASE}/admin/orders/${orderId}/status`, payload);
      if (!res.data?.success) {
        if (String(status).toLowerCase() === "completed") {
          setOtpModal((prev) => ({ ...prev, error: res.data?.message || "Invalid OTP. Order remains pending." }));
        } else {
          alert(res.data?.message || "Failed to update status");
        }
        fetchOrders();
        return;
      }
      if (String(status).toLowerCase() === "completed") {
        closeOtpModal();
      }
      fetchOrders();
      fetchOrderAnalytics();
    } catch (err) {
      if (String(status).toLowerCase() === "completed") {
        setOtpModal((prev) => ({ ...prev, error: "Failed to verify OTP. Please try again." }));
      } else {
        alert("Failed to update order status");
      }
      console.error("admin update order status error", err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const submitOtpCompletion = async () => {
    if (!otpModal.orderId) return;
    await updateAdminOrderStatus(otpModal.orderId, "completed", otpModal.otp);
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === "inventory") {
      fetchProducts();
    } else if (activeTab === "orders") {
      fetchOrders();
    } else if (activeTab === "analysis") {
      fetchOrderAnalytics();
    }
  }, [activeTab]);

  // Handle Inventory Search Filtering
  useEffect(() => {
    if (!searchQuery) {
      setFilteredProducts(products);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(p => p.name.toLowerCase().includes(lowerQ) || String(p.id).includes(lowerQ))
      );
    }
  }, [searchQuery, products]); // Ensure proper closure of useEffect

  // Handle Orders Search Filtering
  useEffect(() => {
    if (!searchOrderQuery) {
      setFilteredOrders(orders);
    } else {
      const lowerQ = searchOrderQuery.toLowerCase();
      setFilteredOrders(
        orders.filter(o => 
          (o.name || "").toLowerCase().includes(lowerQ) || 
          (o.phone || "").includes(lowerQ) ||
          (o.product_name || "").toLowerCase().includes(lowerQ) ||
          (o.delivery_location || "").toLowerCase().includes(lowerQ)
        )
      );
    }
  }, [searchOrderQuery, orders]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await axios.post(`${API_BASE}/admin/products/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        alert("✅ " + res.data.message);
        fetchProducts();
      } else {
        alert("❌ " + res.data.message);
      }
    } catch (err) {
      alert(`❌ ${tt("admin_upload_failed")}: ` + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setEditForm({
      product_name: product.name,
      stock: product.stock,
      price: product.price,
      prescription_required: product.prescription
    });
  };

  const saveProductEdit = async () => {
    setSavingAction(true);
    try {
      const res = await axios.put(`${API_BASE}/admin/products/${editingProduct.id}`, editForm);
      if (res.data.success) {
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (err) {
      alert("❌ Failed to update product: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingAction(false);
    }
  };
const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProductForm.product_name.trim()) {
      alert("Product name is required.");
      return;
    }

    setCreatingProduct(true);
    try {
      const payload = {
        ...newProductForm,
        product_id: newProductForm.product_id.trim() || undefined,
        product_name: newProductForm.product_name.trim(),
        description: newProductForm.description.trim(),
        stock: Number(newProductForm.stock) || 0,
        price: Number(newProductForm.price) || 0,
      };

      const res = await axios.post(`${API_BASE}/admin/products`, payload);
      if (res.data?.success) {
        alert("✅ " + res.data.message);
        setNewProductForm({
          product_id: "",
          product_name: "",
          description: "",
          stock: 0,
          price: 0,
          prescription_required: false,
        });
        setShowCreateProductForm(false);
        fetchProducts();
      } else {
        alert("❌ " + (res.data?.message || "Failed to create product"));
      }
    } catch (err) {
      alert("❌ Failed to create product: " + (err.response?.data?.detail || err.message));
    } finally {
      setCreatingProduct(false);
    }
  };

  const lowStockCount = products.filter(p => p.stock < 10).length;

  return (
    <div className="admin-shell flex h-screen bg-[#F0F4F8] font-sans">
      
      {/* SIDEBAR */}
      <aside className="admin-sidebar w-64 bg-teal-700 text-white flex flex-col shadow-xl hidden md:flex z-20">
        <div className="p-6 border-b border-teal-600 flex items-center gap-3">
          <Pill size={28} className="text-teal-200" />
          <h1 className="text-xl font-bold tracking-wide">PharmaAdmin</h1>
        </div>
        <nav className="admin-nav flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab("analysis")}
            className={`admin-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab === 'analysis' ? 'bg-teal-800 shadow-inner' : 'hover:bg-teal-600'}`}
          >
            <BarChart3 size={20} className={activeTab === 'analysis' ? 'text-white' : 'text-teal-300'} /> {tt("admin_tab_analysis")}
          </button>
          <button 
            onClick={() => setActiveTab("inventory")}
            className={`admin-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab === 'inventory' ? 'bg-teal-800 shadow-inner' : 'hover:bg-teal-600'}`}
          >
            <Package size={20} className={activeTab === 'inventory' ? 'text-white' : 'text-teal-300'} /> {tt("admin_tab_inventory")}
          </button>
          <button 
            onClick={() => setActiveTab("orders")}
            className={`admin-nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab === 'orders' ? 'bg-teal-800 shadow-inner' : 'hover:bg-teal-600'}`}
          >
            <History size={20} className={activeTab === 'orders' ? 'text-white' : 'text-teal-300'} /> {tt("admin_user_orders")}
          </button>
        </nav>
        <div className="p-4 border-t border-teal-600">
          <button onClick={logout} className="admin-btn admin-btn-danger w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition shadow-md">
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="admin-topbar bg-white px-8 py-5 border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800">
              {activeTab === "inventory" ? tt("admin_inventory") : activeTab === "orders" ? tt("admin_orders") : tt("admin_analysis")}
            </h2>
            <p className="text-sm text-gray-500">
              {activeTab === "inventory" ? "Manage products, stock levels, and pricing." : activeTab === "orders" ? "Review booked medicines and customer details." : "Analyze sales trends and customer behavior."}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {activeTab === "inventory" && (
              <div className="flex flex-col items-end gap-2">
                <input 
                  type="file" accept=".xlsx, .xls" ref={fileInputRef} 
                  style={{ display: "none" }} onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                  className="admin-btn admin-btn-primary flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition shadow-md disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
                  {uploading ? tt("admin_uploading") : tt("admin_import_excel")}
                </button>
                <button
                  onClick={() => setShowCreateProductForm((prev) => !prev)}
                  className="admin-btn flex items-center gap-2 px-5 py-2.5 bg-white text-teal-700 font-bold rounded-lg border border-teal-200 hover:bg-teal-50 transition shadow-sm"
                >
                  <PlusCircle size={18} />
                  {showCreateProductForm ? "Hide Add Medicine" : "Add Medicine"}
                </button>
              </div>
            )}
            <button onClick={logout} className="admin-btn admin-btn-danger md:hidden p-2 text-red-500 bg-red-50 rounded-lg">
               Logout
            </button>
          </div>
        </header>

        <div className="admin-mobile-tabs md:hidden px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`admin-mobile-tab ${activeTab === "analysis" ? "active" : ""}`}
          >
            <BarChart3 size={16} /> {tt("admin_tab_analysis")}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`admin-mobile-tab ${activeTab === "inventory" ? "active" : ""}`}
          >
            <Package size={16} /> {tt("admin_tab_inventory")}
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`admin-mobile-tab ${activeTab === "orders" ? "active" : ""}`}
          >
            <History size={16} /> {tt("admin_tab_orders")}
          </button>
        </div>

        {/* DASHBOARD CONTENT */}
        <div className="admin-content flex-1 overflow-auto p-8">
          
          {/* ===================== INVENTORY TAB ===================== */}
          {activeTab === "inventory" && (
            <>
              {/* STATS CARDS */}
              {analysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="admin-stat-card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Products</p>
                      <p className="text-3xl font-black text-gray-800 mt-1">{analysis.total_products}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-full text-blue-500"><Package size={24} /></div>
                  </div>
                  <div className="admin-stat-card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Low Stock Alerts</p>
                      <p className="text-3xl font-black text-red-600 mt-1">{lowStockCount}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-full text-red-500"><Bell size={24} /></div>
                  </div>
                  <div className="admin-stat-card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Average Price</p>
                      <p className="text-3xl font-black text-teal-600 mt-1">${analysis.average_price.toFixed(2)}</p>
                    </div>
                    <div className="bg-teal-50 p-4 rounded-full text-teal-500"><Pill size={24} /></div>
                  </div>
                </div>
              )}

              {showCreateProductForm && (
              <div className="admin-panel bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex items-center gap-3 mb-5">
                  <PlusCircle size={22} className="text-teal-600" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Add Medicine</h3>
                    <p className="text-sm text-gray-500">Create a medicine manually if Excel upload is not working.</p>
                  </div>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={newProductForm.product_id}
                      onChange={(e) => setNewProductForm({ ...newProductForm, product_id: e.target.value })}
                      placeholder="Product ID optional"
                      className="admin-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                    />
                    <input
                      type="text"
                      value={newProductForm.product_name}
                      onChange={(e) => setNewProductForm({ ...newProductForm, product_name: e.target.value })}
                      placeholder="Product name"
                      className="admin-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                    />
                  </div>

                  <textarea
                    value={newProductForm.description}
                    onChange={(e) => setNewProductForm({ ...newProductForm, description: e.target.value })}
                    placeholder="Description"
                    rows={3}
                    className="admin-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition resize-none"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="number"
                      min="0"
                      value={newProductForm.stock}
                      onChange={(e) => setNewProductForm({ ...newProductForm, stock: e.target.value })}
                      placeholder="Stock"
                      className="admin-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newProductForm.price}
                      onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })}
                      placeholder="Price"
                      className="admin-input w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                    />
                  </div>

                  <label className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 w-fit">
                    <input
                      type="checkbox"
                      checked={newProductForm.prescription_required}
                      onChange={(e) => setNewProductForm({ ...newProductForm, prescription_required: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="font-medium text-gray-700">Prescription Required</span>
                  </label>

                  <button
                    type="submit"
                    disabled={creatingProduct}
                    className="admin-btn admin-btn-primary inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition shadow-md disabled:opacity-50"
                  >
                    {creatingProduct ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
                    {creatingProduct ? "Adding..." : "Add Medicine"}
                  </button>
                </form>
              </div>
              )}

              {/* INVENTORY TABLE */}
              <div className="admin-panel bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h3 className="text-lg font-bold text-gray-800">Product List</h3>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder={tt("admin_search_products")} 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="admin-input w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex justify-center py-20"><Loader2 size={40} className="text-teal-600 animate-spin" /></div>
                  ) : (
                    <table className="admin-table-premium w-full table-auto text-left">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-bold">ID</th>
                          <th className="px-6 py-4 font-bold">Name</th>
                          <th className="px-6 py-4 font-bold">Stock</th>
                          <th className="px-6 py-4 font-bold">Price</th>
                          <th className="px-6 py-4 font-bold">Prescription</th>
                          <th className="px-6 py-4 font-bold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-teal-50/50 transition-colors group">
                            <td className="px-6 py-4 text-sm text-gray-500">{p.id}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-800">{p.name}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${p.stock > 10 ? 'bg-green-50 text-green-700 border-green-200' : p.stock > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {p.stock > 0 ? `${p.stock} units` : 'Out of Stock'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-600">${parseFloat(p.price).toFixed(2)}</td>
                            <td className="px-6 py-4">
                              {p.prescription ? (
                                <span className="text-red-600 font-bold text-[11px] bg-red-50 px-2.5 py-1 rounded border border-red-100 uppercase">Required</span>
                              ) : (
                                <span className="text-gray-400 text-xs">No</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => openEditModal(p)}
                                className="admin-icon-btn p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-100 rounded-lg transition opacity-0 group-hover:opacity-100"
                              >
                                <Edit2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center py-10 text-gray-400">No products found matching your search.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ===================== ORDERS TAB ===================== */}
          {activeTab === "orders" && (
            <div className="admin-panel bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-lg font-bold text-gray-800">{tt("admin_all_placed_orders")}</h3>
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder={tt("admin_search_orders")} 
                    value={searchOrderQuery}
                    onChange={(e) => setSearchOrderQuery(e.target.value)}
                    className="admin-input w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                {loadingOrders ? (
                  <div className="flex justify-center py-20"><Loader2 size={40} className="text-teal-600 animate-spin" /></div>
                ) : (
                  <table className="admin-table-premium w-full table-auto text-left">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-bold">Date & Time</th>
                        <th className="px-6 py-4 font-bold">Customer Details</th>
                        <th className="px-6 py-4 font-bold">Medicine Booked</th>
                        <th className="px-6 py-4 font-bold">Booked Location</th>
                        <th className="px-6 py-4 font-bold text-center">Quantity</th>
                        <th className="px-6 py-4 font-bold">Status</th>
                        <th className="px-6 py-4 font-bold">Total Bill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOrders.map((o, idx) => {
                        const dateObj = new Date(o.date);
                        return (
                          <tr key={idx} className="hover:bg-teal-50/50 transition-colors">
                            
                            {/* DATE */}
                            <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                              <div className="font-semibold text-gray-700">
                                {dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>

                            {/* CUSTOMER INFO */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2 font-bold text-gray-800">
                                  <UserCircle size={16} className="text-teal-500" /> {o.name || "Unknown"}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Phone size={14} className="text-gray-400" /> {o.phone || "N/A"}
                                </div>
                              </div>
                            </td>

                            {/* MEDICINE INFO */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shadow-sm">
                                  <Pill size={18} />
                                </div>
                                <span className="font-semibold text-gray-700 max-w-[200px] truncate" title={o.product_name}>
                                  {o.product_name || "Unknown Product"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="max-w-[240px]">
                                <div className="text-sm font-medium text-gray-700 break-words">
                                  {o.delivery_location || "Not provided"}
                                </div>
                                {o.delivery_map_url && (
                                  <a
                                    href={o.delivery_map_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Open location
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* QUANTITY */}
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex min-w-[84px] justify-center bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full text-sm font-extrabold border border-teal-200 shadow-sm">
                                {o.quantity} units
                              </span>
                            </td>

                            {/* STATUS */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                <span className={`w-fit px-3 py-1 rounded-full text-xs font-bold border ${
                                  String(o.status).toLowerCase() === "cancelled"
                                    ? "bg-red-50 text-red-600 border-red-200"
                                    : String(o.status).toLowerCase() === "completed"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {String(o.status || "pending")}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openOtpModal(o.order_id)}
                                    disabled={updatingOrderId === o.order_id || String(o.status).toLowerCase() === "completed"}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-bold border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                                  >
                                    Done
                                  </button>
                                  <button
                                    onClick={() => updateAdminOrderStatus(o.order_id, "cancelled")}
                                    disabled={updatingOrderId === o.order_id || String(o.status).toLowerCase() === "cancelled"}
                                    className="px-2.5 py-1 rounded-md text-[11px] font-bold border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* TOTAL BILL */}
                            <td className="px-6 py-4">
                              <div className="font-bold text-teal-600 text-lg">
                                ${parseFloat(o.price || 0).toFixed(2)}
                              </div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                                Paid/To Pay
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center py-10 text-gray-400">
                            <History className="mx-auto mb-3 opacity-20" size={40} />
                            No orders found matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ===================== ORDER ANALYSIS TAB ===================== */}
          {activeTab === "analysis" && (
            <div className="space-y-8">
              {loadingAnalytics ? (
                <div className="flex justify-center py-20"><Loader2 size={40} className="text-teal-600 animate-spin" /></div>
              ) : orderAnalytics ? (
                <>
                  {/* KEY METRICS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Total Orders */}
                    <div className="admin-metric-card metric-blue bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-md border border-blue-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{tt("admin_total_orders")}</p>
                          <p className="text-4xl font-black text-blue-900 mt-2">{orderAnalytics.total_orders}</p>
                        </div>
                        <div className="bg-white/60 p-3 rounded-full text-blue-600"><ShoppingCart size={24} /></div>
                      </div>
                    </div>

                    {/* Total Revenue */}
                    <div className="admin-metric-card metric-green bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl shadow-md border border-green-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-green-600 uppercase tracking-widest">{tt("admin_total_revenue")}</p>
                          <p className="text-4xl font-black text-green-900 mt-2">${orderAnalytics.total_revenue}</p>
                        </div>
                        <div className="bg-white/60 p-3 rounded-full text-green-600"><TrendingUp size={24} /></div>
                      </div>
                    </div>

                    {/* Avg Order Value */}
                    <div className="admin-metric-card metric-purple bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl shadow-md border border-purple-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">{tt("admin_avg_order_value")}</p>
                          <p className="text-4xl font-black text-purple-900 mt-2">${orderAnalytics.avg_order_value}</p>
                        </div>
                        <div className="bg-white/60 p-3 rounded-full text-purple-600"><Pill size={24} /></div>
                      </div>
                    </div>

                    {/* Total Items Sold */}
                    <div className="admin-metric-card metric-orange bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl shadow-md border border-orange-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">{tt("admin_items_sold")}</p>
                          <p className="text-4xl font-black text-orange-900 mt-2">{orderAnalytics.total_quantity_sold}</p>
                        </div>
                        <div className="bg-white/60 p-3 rounded-full text-orange-600"><Package size={24} /></div>
                      </div>
                    </div>
                  </div>

                  {/* TOP SELLING PRODUCTS */}
                  <div className="admin-panel bg-white rounded-2xl shadow-md border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <BarChart3 size={24} className="text-teal-600" /> {tt("admin_top_selling")}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="admin-table-premium w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase">{tt("admin_product_name")}</th>
                            <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 uppercase">{tt("admin_units_sold")}</th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-gray-600 uppercase">{tt("admin_revenue")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderAnalytics.top_products && orderAnalytics.top_products.length > 0 ? (
                            orderAnalytics.top_products.map((product, idx) => (
                              <tr key={idx} className="border-b border-gray-100 hover:bg-teal-50/50 transition">
                                <td className="px-4 py-4 font-semibold text-gray-700">{idx + 1}. {product.name}</td>
                                <td className="text-center px-4 py-4">
                                  <span className="bg-blue-100 text-blue-700 font-bold py-1 px-3 rounded-full text-sm">
                                    {product.quantity} units
                                  </span>
                                </td>
                                <td className="text-right px-4 py-4">
                                  <span className="font-bold text-green-600 text-lg">${product.revenue.toFixed(2)}</span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="text-center py-8 text-gray-400">{tt("no_products")}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 7-DAY SALES TREND */}
                  <div className="admin-panel bg-white rounded-2xl shadow-md border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <Calendar size={24} className="text-teal-600" /> {tt("admin_sales_trend")}
                    </h3>
                    <div className="space-y-3">
                      {orderAnalytics.orders_by_date && orderAnalytics.orders_by_date.map((day, idx) => {
                        const maxOrders = Math.max(...orderAnalytics.orders_by_date.map(d => d.orders), 1);
                        const barWidth = (day.orders / maxOrders) * 100;
                        return (
                          <div key={idx} className="flex items-center gap-4">
                            <div className="w-20 text-sm font-semibold text-gray-600">{new Date(day.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</div>
                            <div className="flex-1">
                              <div className="bg-gray-100 rounded-full h-12 relative overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-teal-400 to-teal-600 h-full flex items-center px-4 transition-all duration-300"
                                  style={{width: `${barWidth}%`}}
                                >
                                  {day.orders > 0 && <span className="text-white font-bold text-sm">{day.orders} orders</span>}
                                </div>
                              </div>
                            </div>
                            <div className="w-24 text-right">
                              <p className="font-bold text-gray-800">${day.revenue.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">{tt("admin_revenue")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <BarChart3 size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 text-lg">{tt("admin_no_data")}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* EDIT MODAL (Only active in Inventory Tab) */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">{tt("admin_edit_product")}</h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{tt("admin_product_name")}</label>
                <input 
                  type="text" 
                  value={editForm.product_name}
                  onChange={(e) => setEditForm({...editForm, product_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{tt("admin_stock_level")}</label>
                  <input 
                    type="number" 
                    value={editForm.stock}
                    onChange={(e) => setEditForm({...editForm, stock: parseInt(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{tt("admin_price_label")}</label>
                  <input 
                    type="number" step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({...editForm, price: parseFloat(e.target.value) || 0})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <input 
                  type="checkbox" 
                  id="prescription_check"
                  checked={editForm.prescription_required}
                  onChange={(e) => setEditForm({...editForm, prescription_required: e.target.checked})}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="prescription_check" className="font-medium text-gray-700 cursor-pointer">
                  {tt("admin_prescription_required")}
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setEditingProduct(null)}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition"
              >
                {t ? t("close") : "Close"}
              </button>
              <button 
                onClick={saveProductEdit}
                disabled={savingAction}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
              >
                {savingAction ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {savingAction ? tt("admin_saving") : tt("admin_save_changes")}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {otpModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">Verify Order OTP</h3>
              <button onClick={closeOtpModal} className="text-gray-400 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Enter the 6-digit OTP sent to the customer on WhatsApp to mark this order as completed.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={otpModal.otp}
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpModal((prev) => ({ ...prev, otp: onlyDigits, error: "" }));
                }}
                placeholder="Enter OTP"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 tracking-[0.3em] text-center font-bold text-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              {otpModal.error && (
                <div className="text-sm rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-700">
                  {otpModal.error}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={closeOtpModal}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={submitOtpCompletion}
                disabled={updatingOrderId === otpModal.orderId}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
              >
                {updatingOrderId === otpModal.orderId ? <Loader2 size={18} className="animate-spin" /> : null}
                Verify & Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
