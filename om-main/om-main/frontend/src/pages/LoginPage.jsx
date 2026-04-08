import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle, Upload, Users } from "lucide-react";
import axios from "axios";
import "../styles/LoginPage.css";
import { API_BASE } from "../config/api";
import { setAuthToken } from "../config/auth";
const SYSTEM_MANAGER_ID = import.meta.env.VITE_SYSTEM_MANAGER_ID || "sysmanager";

export default function LoginPage({ onLogin }) {
  // ========== STATE MANAGEMENT ==========
  const [activeTab, setActiveTab] = useState("login");
  const [userRole, setUserRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    email: "",
    managerId: "",
    phone: "",
    doctorId: "",
    pharmaId: "",
    ownerName: "",
    storeName: "",
    mobileNumber: "",
    pharmaEmail: "",
    storeAddress: "",
    pharmacyLicenseNumber: "",
    pharmacyAddress: "",
    gender: "",
    specialty: "",
    experienceYears: "",
    qualification: "",
    hospitalName: "",
    address: "",
    fees: "",
    profileImage: "",
    degreeCertificateImage: "",
    password: "",
    confirmPassword: "",
    name: "",
    age: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotPasswordModal, setForgotPasswordModal] = useState({
    open: false,
    phone: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
    step: "request",
    loading: false,
    error: "",
    success: "",
  });
  const [contactImportModal, setContactImportModal] = useState({
    open: false,
    user: null,
    role: "user",
    sessionId: null,
    contactsText: "",
    fileName: "",
    loading: false,
    error: "",
    success: "",
  });

  // ========== CONSTANTS ==========
  const ROLES = [
    { id: "user", label: "Customer", icon: "👤", description: "Order medications" },
    { id: "admin", label: "Pharmacist", icon: "💊", description: "Manage pharmacy" },
    { id: "doctor", label: "Doctor", icon: "🩺", description: "View patient orders" },
    { id: "delivery_boy", label: "Delivery Boy", icon: "DB", description: "Deliver medicine orders" },
    { id: "system_manager", label: "System Manager", icon: "⚙️", description: "Manage system & approvals" },
  ];

  // ========== HANDLERS ==========
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files?.[0];
    if (!file) {
      setFormData((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, [name]: reader.result }));
    };
    reader.readAsDataURL(file);
    setError("");
  };

  const normalizePhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const parseTrustedContacts = (rawText) => {
    const items = String(rawText || "")
      .split(/[\n,\r;\t ]+/)
      .map((value) => normalizePhone(value))
      .filter((value) => value.length === 10);
    return Array.from(new Set(items));
  };

  const openContactImportModal = ({ user, role, sessionId }) => {
    setContactImportModal({
      open: true,
      user,
      role,
      sessionId,
      contactsText: "",
      fileName: "",
      loading: false,
      error: "",
      success: "",
    });
  };

  const finishAuthFlow = () => {
    if (!contactImportModal.user) {
      return;
    }
    const nextRole = contactImportModal.role;
    const nextUser = contactImportModal.user;
    const nextSessionId = contactImportModal.sessionId;
    setContactImportModal({
      open: false,
      user: null,
      role: "user",
      sessionId: null,
      contactsText: "",
      fileName: "",
      loading: false,
      error: "",
      success: "",
    });
    onLogin(nextRole, nextUser, nextSessionId);
  };

  const handleTrustedContactsFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setContactImportModal((prev) => ({
        ...prev,
        contactsText: String(reader.result || ""),
        fileName: file.name,
        error: "",
        success: "",
      }));
    };
    reader.readAsText(file);
  };

  const submitTrustedContacts = async () => {
    const contacts = parseTrustedContacts(contactImportModal.contactsText);
    if (contacts.length === 0) {
      setContactImportModal((prev) => ({
        ...prev,
        error: "Add at least one valid 10-digit phone number.",
        success: "",
      }));
      return;
    }

    setContactImportModal((prev) => ({
      ...prev,
      loading: true,
      error: "",
      success: "",
    }));

    try {
      const response = await axios.post(`${API_BASE}/auth/contacts/import`, {
        user_id: contactImportModal.user?.id,
        contacts,
      });
      if (!response.data?.success) {
        setContactImportModal((prev) => ({
          ...prev,
          loading: false,
          error: response.data?.message || "Failed to import trusted contacts.",
          success: "",
        }));
        return;
      }

      setContactImportModal((prev) => ({
        ...prev,
        loading: false,
        success: `Imported ${response.data?.count || contacts.length} trusted contacts.`,
        error: "",
      }));
      setTimeout(() => {
        finishAuthFlow();
      }, 700);
    } catch (err) {
      setContactImportModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to import trusted contacts.",
        success: "",
      }));
    }
  };

  const continueUserAuthFlow = async ({ user, role, sessionId, forcePrompt = false }) => {
    if (!user?.id) {
      onLogin(role, user, sessionId);
      return;
    }
    if (forcePrompt) {
      openContactImportModal({ user, role, sessionId });
      return;
    }
    try {
      const response = await axios.get(`${API_BASE}/auth/contacts/status/${user.id}`);
      if (response.data?.has_contacts) {
        onLogin(role, user, sessionId);
        return;
      }
    } catch (err) {
      console.error('Failed to check trusted contact status:', err);
    }
    openContactImportModal({ user, role, sessionId });
  };

  const switchRole = (roleId) => {
    setUserRole(roleId);
    setFormData({
      email: "",
      managerId: "",
      phone: "",
      doctorId: "",
      pharmaId: "",
      ownerName: "",
      storeName: "",
      mobileNumber: "",
      pharmaEmail: "",
      storeAddress: "",
      pharmacyLicenseNumber: "",
      pharmacyAddress: "",
      gender: "",
      specialty: "",
      experienceYears: "",
      qualification: "",
      hospitalName: "",
      address: "",
      fees: "",
      profileImage: "",
      degreeCertificateImage: "",
      password: "",
      confirmPassword: "",
      name: "",
      age: "",
    });
    setError("");
    setSuccess("");
    if (roleId === "system_manager") {
      setActiveTab("login");
    }
  };

  const validateForm = () => {
    if (activeTab === "login") {
      if (userRole === "system_manager") {
        if (!formData.managerId.trim()) {
          setError("System Manager ID is required");
          return false;
        }
      } else if (userRole === "delivery_boy") {
        if (!formData.name.trim()) {
          setError("Delivery boy name is required");
          return false;
        }
      } else if (userRole === "doctor") {
        if (!formData.doctorId.trim() && !formData.email.trim()) {
          setError("Doctor email or doctor ID is required");
          return false;
        }
      } else if (userRole === "admin") {
        if (!formData.pharmaId.trim()) {
          setError("Pharma ID is required");
          return false;
        }
      } else {
        if (!formData.phone.trim()) {
          setError("Phone number is required");
          return false;
        }
        if (!formData.phone.match(/^\d{10}$/)) {
          setError("Please enter a valid 10-digit phone number");
          return false;
        }
      }
      
      if (!formData.password.trim()) {
        setError("Password is required");
        return false;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        return false;
      }
    } else {
      // Register validation
      if (!formData.password.trim()) {
        setError("Password is required");
        return false;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return false;
      }
      
      if (userRole === "doctor") {
        if (!formData.name.trim()) {
          setError("Doctor name is required");
          return false;
        }
        if (!formData.email.trim()) {
          setError("Email is required");
          return false;
        }
        if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          setError("Please enter a valid email address");
          return false;
        }
        if (!formData.phone.trim()) {
          setError("Phone number is required");
          return false;
        }
        if (!formData.specialty.trim()) {
          setError("Specialist field is required");
          return false;
        }
        if (!formData.gender.trim()) {
          setError("Gender is required");
          return false;
        }
        if (!formData.experienceYears.trim()) {
          setError("Experience is required");
          return false;
        }
        if (!formData.qualification.trim()) {
          setError("Qualification is required");
          return false;
        }
        if (!formData.hospitalName.trim()) {
          setError("Hospital name is required");
          return false;
        }
        if (!formData.address.trim()) {
          setError("Address is required");
          return false;
        }
        if (!formData.fees.trim()) {
          setError("Fees are required");
          return false;
        }
        if (!formData.profileImage) {
          setError("Doctor image is required");
          return false;
        }
        if (!formData.degreeCertificateImage) {
          setError("Degree certificate image is required");
          return false;
        }
      } else if (userRole === "system_manager") {
        if (!formData.email.trim()) {
          setError("Email is required");
          return false;
        }
      } else if (userRole === "delivery_boy") {
        if (!formData.name.trim()) {
          setError("Delivery boy name is required");
          return false;
        }
        if (!formData.phone.trim()) {
          setError("Phone number is required");
          return false;
        }
        if (!formData.phone.match(/^\d{10}$/)) {
          setError("Please enter a valid 10-digit phone number");
          return false;
        }
        if (!formData.age.trim()) {
          setError("Age is required");
          return false;
        }
        if (!formData.gender.trim()) {
          setError("Gender is required");
          return false;
        }
      } else if (userRole === "admin") {
        if (!formData.storeName.trim()) {
          setError("Store name is required");
          return false;
        }
        if (!formData.ownerName.trim()) {
          setError("Owner name is required");
          return false;
        }
        if (!formData.mobileNumber.trim()) {
          setError("Mobile number is required");
          return false;
        }
        if (!formData.pharmaEmail.trim()) {
          setError("Email is required");
          return false;
        }
        if (!formData.pharmaId.trim()) {
          setError("Pharma ID is required");
          return false;
        }
        if (!formData.storeAddress.trim()) {
          setError("Store address is required");
          return false;
        }
        if (!formData.pharmacyLicenseNumber.trim()) {
          setError("Pharmacy license number is required");
          return false;
        }
        if (!formData.pharmacyAddress.trim()) {
          setError("Pharmacy address is required");
          return false;
        }
      } else {
        if (!formData.name.trim()) {
          setError("Name is required");
          return false;
        }
        if (!formData.phone.trim()) {
          setError("Phone number is required");
          return false;
        }
        if (!formData.phone.match(/^\d{10}$/)) {
          setError("Please enter a valid 10-digit phone number");
          return false;
        }
      }

    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let endpoint = "";
      let payload = {};

      if (userRole === "doctor") {
        endpoint = `${API_BASE}/doctor/login`;
        payload = {
          doctor_id: formData.doctorId || null,
          email: formData.email || null,
          password: formData.password,
        };
      } else if (userRole === "delivery_boy") {
        endpoint = `${API_BASE}/delivery/login`;
        payload = {
          name: formData.name,
          password: formData.password,
        };
      } else if (userRole === "system_manager") {
        endpoint = `${API_BASE}/auth/system-manager/login`;
        payload = {
          manager_id: formData.managerId,
          password: formData.password,
        };
      } else {
        endpoint = `${API_BASE}/auth/login`;
        payload = {
          phone: userRole === "admin" ? null : formData.phone,
          pharma_id: userRole === "admin" ? formData.pharmaId : null,
          password: formData.password,
        };
      }

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        setSuccess("✓ Login successful! Redirecting...");
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", formData.email || formData.phone || formData.doctorId || formData.pharmaId || formData.managerId);
        }
        setTimeout(() => {
          const loggedInUser = response.data.user || response.data.doctor || response.data.system_manager || response.data.delivery_boy;
          if (response.data.access_token) {
            setAuthToken(response.data.access_token);
          }
          const finalUser =
            userRole === "system_manager"
              ? {
                  ...loggedInUser,
                  manager_id: formData.managerId,
                }
              : loggedInUser;

          if (userRole === "user") {
            continueUserAuthFlow({
              user: finalUser,
              role: userRole,
              sessionId: response.data.session_id,
              forcePrompt: false,
            });
            return;
          }

          onLogin(userRole, finalUser, response.data.session_id);
        }, 1000);
      } else {
        setError(response.data.message || "Login failed. Please try again.");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || err.message || "An error occurred";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let endpoint = "";
      let payload = {};

      if (userRole === "doctor") {
        endpoint = `${API_BASE}/doctor/register`;
        payload = {
          doctor_id: formData.doctorId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          gender: formData.gender,
          specialty: formData.specialty,
          experience_years: parseInt(formData.experienceYears, 10) || 0,
          qualification: formData.qualification,
          hospital_name: formData.hospitalName,
          address: formData.address,
          appointment_fee: formData.fees ? parseFloat(formData.fees) : null,
          profile_image: formData.profileImage,
          degree_certificate_image: formData.degreeCertificateImage,
          password: formData.password,
        };
      } else if (userRole === "delivery_boy") {
        endpoint = `${API_BASE}/delivery/register`;
        payload = {
          name: formData.name,
          phone: formData.phone,
          age: parseInt(formData.age, 10) || 0,
          gender: formData.gender,
          password: formData.password,
        };
      } else if (userRole === "system_manager") {
        setError("System Manager account creation is disabled. Use the predefined login credentials.");
        setLoading(false);
        return;
      } else if (userRole === "admin") {
        endpoint = `${API_BASE}/auth/pharmacist/request`;
        payload = {
          store_name: formData.storeName,
          owner_name: formData.ownerName,
          mobile_number: formData.mobileNumber,
          email: formData.pharmaEmail,
          pharma_id: formData.pharmaId,
          store_address: formData.storeAddress,
          pharmacy_license_number: formData.pharmacyLicenseNumber,
          pharmacy_address: formData.pharmacyAddress,
          password: formData.password,
        };
      } else {
        endpoint = `${API_BASE}/auth/register`;
        payload = {
          name: formData.name,
          phone: formData.phone,
          shop_id: null,
          password: formData.password,
          age: formData.age ? parseInt(formData.age, 10) : null,
        };
      }

      const response = await axios.post(endpoint, payload);

      if (response.data.success) {
        if (response.data.access_token) {
          setAuthToken(response.data.access_token);
        }
        setSuccess(userRole === "admin" 
          ? "✓ Registration request submitted! Waiting for approval."
          : userRole === "doctor"
          ? `✓ Registration submitted! Your login ID is ${response.data.login_id || formData.doctorId || formData.email}.`
          : "✓ Registration successful! You can now login.");
        if (userRole === "user" && response.data.user) {
          setTimeout(() => {
            continueUserAuthFlow({
              user: response.data.user,
              role: "user",
              sessionId: response.data.session_id,
              forcePrompt: true,
            });
          }, 800);
          return;
        }
        setTimeout(() => {
          setFormData({
            email: "", managerId: "", phone: "", doctorId: "", pharmaId: "", ownerName: "",
            storeName: "", mobileNumber: "", pharmaEmail: "", storeAddress: "",
            pharmacyLicenseNumber: "", pharmacyAddress: "", gender: "", specialty: "",
            experienceYears: "", qualification: "", hospitalName: "", address: "",
            fees: "", profileImage: "", degreeCertificateImage: "", password: "",
            confirmPassword: "", name: "", age: "",
          });
          setActiveTab("login");
        }, 1500);
      } else {
        setError(response.data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.detail || err.message || "An error occurred";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      managerId: "",
      phone: "",
      doctorId: "",
      pharmaId: "",
      ownerName: "",
      storeName: "",
      mobileNumber: "",
      pharmaEmail: "",
      storeAddress: "",
      pharmacyLicenseNumber: "",
      pharmacyAddress: "",
      gender: "",
      specialty: "",
      experienceYears: "",
      qualification: "",
      hospitalName: "",
      address: "",
      fees: "",
      profileImage: "",
      degreeCertificateImage: "",
      password: "",
      confirmPassword: "",
      name: "", age: "",
    });
    setError("");
    setSuccess("");
  };

  const openForgotPasswordModal = () => {
    if (userRole !== "user") {
      setError("Password reset is currently available only for customer accounts.");
      return;
    }
    setForgotPasswordModal({
      open: true,
      phone: formData.phone || "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
      step: "request",
      loading: false,
      error: "",
      success: "",
    });
  };

  const closeForgotPasswordModal = () => {
    setForgotPasswordModal({
      open: false,
      phone: "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
      step: "request",
      loading: false,
      error: "",
      success: "",
    });
  };

  const requestPasswordResetOtp = async () => {
    const phone = forgotPasswordModal.phone.trim();
    if (!/^\d{10}$/.test(phone)) {
      setForgotPasswordModal((prev) => ({
        ...prev,
        error: "Please enter a valid 10-digit phone number.",
        success: "",
      }));
      return;
    }

    setForgotPasswordModal((prev) => ({
      ...prev,
      loading: true,
      error: "",
      success: "",
    }));

    try {
      const response = await axios.post(`${API_BASE}/auth/forgot-password/request`, { phone }, { timeout: 12000 });
      if (response.data?.success) {
        setForgotPasswordModal((prev) => ({
          ...prev,
          loading: false,
          step: "reset",
          success: response.data.message || "OTP sent to your WhatsApp number.",
          error: "",
        }));
      } else {
        setForgotPasswordModal((prev) => ({
          ...prev,
          loading: false,
          error: response.data?.message || "Failed to send OTP.",
          success: "",
        }));
      }
    } catch (err) {
      setForgotPasswordModal((prev) => ({
        ...prev,
        loading: false,
        error:
          err.code === "ECONNABORTED"
            ? "Password reset request timed out. Please check backend/WhatsApp configuration and try again."
            : err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to send OTP.",
        success: "",
      }));
    }
  };

  const submitPasswordReset = async () => {
    const phone = forgotPasswordModal.phone.trim();
    const otp = forgotPasswordModal.otp.trim();
    const newPassword = forgotPasswordModal.newPassword;
    const confirmPassword = forgotPasswordModal.confirmPassword;

    if (!/^\d{10}$/.test(phone)) {
      setForgotPasswordModal((prev) => ({ ...prev, error: "Please enter a valid 10-digit phone number.", success: "" }));
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setForgotPasswordModal((prev) => ({ ...prev, error: "Please enter the 6-digit OTP sent to WhatsApp.", success: "" }));
      return;
    }
    if (newPassword.length < 6) {
      setForgotPasswordModal((prev) => ({ ...prev, error: "Password must be at least 6 characters.", success: "" }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotPasswordModal((prev) => ({ ...prev, error: "Passwords do not match.", success: "" }));
      return;
    }

    setForgotPasswordModal((prev) => ({
      ...prev,
      loading: true,
      error: "",
      success: "",
    }));

    try {
      const response = await axios.post(`${API_BASE}/auth/forgot-password/reset`, {
        phone,
        otp,
        new_password: newPassword,
      });
      if (response.data?.success) {
        setFormData((prev) => ({ ...prev, phone, password: "" }));
        setForgotPasswordModal((prev) => ({
          ...prev,
          loading: false,
          success: response.data.message || "Password reset successful.",
          error: "",
        }));
        setTimeout(() => {
          closeForgotPasswordModal();
        }, 1200);
      } else {
        setForgotPasswordModal((prev) => ({
          ...prev,
          loading: false,
          error: response.data?.message || "Password reset failed.",
          success: "",
        }));
      }
    } catch (err) {
      setForgotPasswordModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || err.response?.data?.detail || err.message || "Password reset failed.",
        success: "",
      }));
    }
  };

  // ========== RENDER ==========
  return (
    <div className="login-page">
      {/* Background decorative elements */}
      <div className="login-bg-decoration login-bg-shape-1"></div>
      <div className="login-bg-decoration login-bg-shape-2"></div>
      <div className="login-bg-decoration login-bg-shape-3"></div>

      <div className="login-container">
        {/* Left Panel - Branding */}
        <div className="login-left-panel">
          <div className="login-logo-section">
            <div className="login-logo">
              <div className="login-logo-icon">💊</div>
              <h1 className="login-brand-name">MediPharm</h1>
              <p className="login-brand-tagline">Your Trusted Healthcare Partner</p>
            </div>
          </div>

          <div className="login-features">
            <div className="login-feature-item">
              <div className="login-feature-icon">🔒</div>
              <div>
                <h4>Secure & Private</h4>
                <p>Your data is encrypted and protected</p>
              </div>
            </div>
            <div className="login-feature-item">
              <div className="login-feature-icon">⚡</div>
              <div>
                <h4>Fast & Reliable</h4>
                <p>Instant order processing and delivery</p>
              </div>
            </div>
            <div className="login-feature-item">
              <div className="login-feature-icon">🏥</div>
              <div>
                <h4>Professional Care</h4>
                <p>Licensed doctors and pharmacists</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="login-right-panel">
          {/* Role Selector */}
          <div className="login-role-selector">
            {ROLES.map(role => (
              <button
                key={role.id}
                className={`login-role-btn ${userRole === role.id ? "active" : ""}`}
                onClick={() => switchRole(role.id)}
                disabled={loading}
              >
                <div className="login-role-icon">{role.icon}</div>
                <div className="login-role-label">{role.label}</div>
              </button>
            ))}
          </div>

          {/* Tab Buttons */}
          <div className="login-tabs">
            <button
              className={`login-tab-btn ${activeTab === "login" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("login");
                resetForm();
              }}
              disabled={loading}
            >
              Sign In
            </button>
            {userRole !== "system_manager" && (
              <button
                className={`login-tab-btn ${activeTab === "register" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("register");
                  resetForm();
                }}
                disabled={loading}
              >
                Sign Up
              </button>
            )}
          </div>

          {/* Form Container */}
          <form className="login-form" onSubmit={activeTab === "login" ? handleLogin : handleRegister}>
            {/* Error Message */}
            {error && (
              <div className="login-alert login-alert-error">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="login-alert login-alert-success">
                <CheckCircle size={20} />
                <span>{success}</span>
              </div>
            )}

            {/* Registration Form */}
            {activeTab === "register" && (
              <>
                {userRole === "doctor" ? (
                  <>
                    <div className="login-form-group">
                      <label className="login-label">Doctor Name</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter doctor name" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Doctor ID</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="doctorId" value={formData.doctorId} onChange={handleInputChange} placeholder="Optional custom doctor ID" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Email Address</label>
                      <div className="login-input-wrapper">
                        <Mail size={18} className="login-input-icon" />
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="doctor@example.com" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Phone Number</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Enter mobile number" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Specialist</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="specialty" value={formData.specialty} onChange={handleInputChange} placeholder="Cardiologist, ENT, etc." className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Gender</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <select name="gender" value={formData.gender} onChange={handleInputChange} className="login-input" disabled={loading}>
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Fees</label>
                      <div className="login-input-wrapper">
                        <Lock size={18} className="login-input-icon" />
                        <input type="number" name="fees" value={formData.fees} onChange={handleInputChange} placeholder="Consultation fee" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Experience</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="number" name="experienceYears" value={formData.experienceYears} onChange={handleInputChange} placeholder="Years of experience" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Qualification</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="qualification" value={formData.qualification} onChange={handleInputChange} placeholder="MBBS, MD, etc." className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Hospital Name</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="hospitalName" value={formData.hospitalName} onChange={handleInputChange} placeholder="Hospital or clinic name" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Address</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Full address" className="login-input" disabled={loading} rows="3" />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Upload Doctor Image</label>
                      <div className="login-input-wrapper">
                        <input type="file" name="profileImage" accept="image/*" onChange={handleFileChange} className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Upload Degree Certificate Image</label>
                      <div className="login-input-wrapper">
                        <input type="file" name="degreeCertificateImage" accept="image/*" onChange={handleFileChange} className="login-input" disabled={loading} />
                      </div>
                    </div>
                  </>
                ) : userRole === "admin" ? (
                  <>
                    <div className="login-form-group">
                      <label className="login-label">Store Name</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="storeName" value={formData.storeName} onChange={handleInputChange} placeholder="Enter store name" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Owner Name</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} placeholder="Enter owner name" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Mobile Number</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} placeholder="Enter mobile number" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Email ID</label>
                      <div className="login-input-wrapper">
                        <Mail size={18} className="login-input-icon" />
                        <input type="email" name="pharmaEmail" value={formData.pharmaEmail} onChange={handleInputChange} placeholder="Enter email ID" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Pharma ID</label>
                      <div className="login-input-wrapper">
                        <Lock size={18} className="login-input-icon" />
                        <input type="text" name="pharmaId" value={formData.pharmaId} onChange={handleInputChange} placeholder="Enter pharma ID" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Store Address</label>
                      <div className="login-input-wrapper">
                        <textarea name="storeAddress" value={formData.storeAddress} onChange={handleInputChange} placeholder="Enter store address" className="login-input" disabled={loading} rows="3" />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Pharmacy License Number</label>
                      <div className="login-input-wrapper">
                        <Lock size={18} className="login-input-icon" />
                        <input type="text" name="pharmacyLicenseNumber" value={formData.pharmacyLicenseNumber} onChange={handleInputChange} placeholder="Enter license number" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Pharmacy Address</label>
                      <div className="login-input-wrapper">
                        <textarea name="pharmacyAddress" value={formData.pharmacyAddress} onChange={handleInputChange} placeholder="Enter pharmacy address" className="login-input" disabled={loading} rows="3" />
                      </div>
                    </div>
                  </>
                ) : userRole === "delivery_boy" ? (
                  <>
                    <div className="login-form-group">
                      <label className="login-label">Delivery Boy Name</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter delivery boy name" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Phone Number</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="10-digit phone number" className="login-input" disabled={loading} maxLength="10" />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Age</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="number" name="age" value={formData.age} onChange={handleInputChange} placeholder="Delivery boy age" className="login-input" disabled={loading} min="18" max="120" />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Gender</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <select name="gender" value={formData.gender} onChange={handleInputChange} className="login-input" disabled={loading}>
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="login-form-group">
                      <label className="login-label">Full Name</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter your full name" className="login-input" disabled={loading} />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Phone Number</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="10-digit phone number" className="login-input" disabled={loading} maxLength="10" />
                      </div>
                    </div>
                    <div className="login-form-group">
                      <label className="login-label">Age (Optional)</label>
                      <div className="login-input-wrapper">
                        <User size={18} className="login-input-icon" />
                        <input type="number" name="age" value={formData.age} onChange={handleInputChange} placeholder="Your age" className="login-input" disabled={loading} min="18" max="120" />
                      </div>
                    </div>
                  </>
                )}

                {/* Password Field */}
                <div className="login-form-group">
                  <label className="login-label">Password</label>
                  <div className="login-input-wrapper">
                    <Lock size={18} className="login-input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Minimum 6 characters"
                      className="login-input"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="login-input-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="login-form-group">
                  <label className="login-label">Confirm Password</label>
                  <div className="login-input-wrapper">
                    <Lock size={18} className="login-input-icon" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm your password"
                      className="login-input"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="login-input-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Login Form */}
            {activeTab === "login" && (
              <>
                {/* Email/Phone Field */}
                {userRole === "system_manager" ? (
                  <div className="login-form-group">
                    <label className="login-label">System Manager ID</label>
                    <div className="login-input-wrapper">
                      <User size={18} className="login-input-icon" />
                      <input
                        type="text"
                        name="managerId"
                        value={formData.managerId}
                        onChange={handleInputChange}
                        placeholder="Enter system manager ID"
                        className="login-input"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ) : userRole === "doctor" ? (
                  <div className="login-form-group">
                    <label className="login-label">Doctor Email or ID</label>
                    <div className="login-input-wrapper">
                      <Mail size={18} className="login-input-icon" />
                      <input
                        type="text"
                        value={formData.email || formData.doctorId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            email: value.includes("@") ? value : "",
                            doctorId: value.includes("@") ? "" : value,
                          }));
                          setError("");
                        }}
                        placeholder="Enter your approved doctor email or ID"
                        className="login-input"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ) : userRole === "admin" ? (
                  <div className="login-form-group">
                    <label className="login-label">Pharma ID</label>
                    <div className="login-input-wrapper">
                      <User size={18} className="login-input-icon" />
                      <input
                        type="text"
                        name="pharmaId"
                        value={formData.pharmaId}
                        onChange={handleInputChange}
                        placeholder="Enter your pharma ID"
                        className="login-input"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ) : userRole === "delivery_boy" ? (
                  <div className="login-form-group">
                    <label className="login-label">Delivery Boy Name</label>
                    <div className="login-input-wrapper">
                      <User size={18} className="login-input-icon" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Enter approved delivery boy name"
                        className="login-input"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="login-form-group">
                    <label className="login-label">Phone Number</label>
                    <div className="login-input-wrapper">
                      <User size={18} className="login-input-icon" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="10-digit phone number"
                        className="login-input"
                        disabled={loading}
                        maxLength="10"
                      />
                    </div>
                  </div>
                )}

                {userRole === "system_manager" && (
                  <div className="login-alert login-alert-success">
                    <CheckCircle size={20} />
                    <span>{`Use your configured system manager ID. Default ID: ${SYSTEM_MANAGER_ID}`}</span>
                  </div>
                )}

                {/* Password Field */}
                <div className="login-form-group">
                  <label className="login-label">Password</label>
                  <div className="login-input-wrapper">
                    <Lock size={18} className="login-input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      className="login-input"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="login-input-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="login-form-checkbox">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="login-checkbox"
                  />
                  <label htmlFor="rememberMe" className="login-checkbox-label">
                    Remember me on this device
                  </label>
                </div>

                {/* Forgot Password Link */}
                <div className="login-forgot-password">
                  <a href="#" onClick={(e) => { e.preventDefault(); openForgotPasswordModal(); }}>
                    Forgot your password?
                  </a>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="login-spinner"></div>
                  {activeTab === "login" ? "Signing In..." : "Creating Account..."}
                </>
              ) : (
                activeTab === "login" ? "Sign In" : "Create Account"
              )}
            </button>

            {/* Terms */}
            <p className="login-terms">
              By continuing, you agree to our{" "}
              <a href="#">Terms of Service</a> and{" "}
              <a href="#">Privacy Policy</a>
            </p>
          </form>

          {contactImportModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                      <Users size={14} />
                      Trusted Contacts
                    </div>
                    <h3 className="mt-3 text-2xl font-bold text-slate-900">Import Phone Contacts for Trusted Reviews</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Paste 10-digit phone numbers or upload a CSV/TXT file. The system will highlight doctor reviews written by people in your trusted circle.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={finishAuthFlow}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Not Now
                  </button>
                </div>

                {contactImportModal.error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {contactImportModal.error}
                  </div>
                )}

                {contactImportModal.success && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {contactImportModal.success}
                  </div>
                )}

                <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <label className="login-label">Paste phone numbers</label>
                    <textarea
                      rows={8}
                      value={contactImportModal.contactsText}
                      onChange={(e) => setContactImportModal((prev) => ({ ...prev, contactsText: e.target.value, error: "", success: "" }))}
                      placeholder={"9876543210\n8888888888\n7777777777"}
                      className="login-input !min-h-[220px] !pl-4"
                      disabled={contactImportModal.loading}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Accepted format: line-separated, comma-separated, CSV, or TXT.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center">
                        <div className="rounded-full bg-white p-3 shadow-sm">
                          <Upload size={20} className="text-sky-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Upload CSV or TXT</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {contactImportModal.fileName || "Choose a contact file"}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={handleTrustedContactsFile}
                          className="hidden"
                          disabled={contactImportModal.loading}
                        />
                      </label>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ready to import</p>
                      <p className="mt-2 text-3xl font-black text-slate-900">
                        {parseTrustedContacts(contactImportModal.contactsText).length}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">Valid 10-digit phone numbers detected.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={finishAuthFlow}
                    disabled={contactImportModal.loading}
                    className="rounded-xl bg-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-60"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={submitTrustedContacts}
                    disabled={contactImportModal.loading}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {contactImportModal.loading ? "Importing..." : "Import Contacts"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {forgotPasswordModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Reset Password</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Enter your customer phone number. We will send a WhatsApp OTP to reset your password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeForgotPasswordModal}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Close
                  </button>
                </div>

                {forgotPasswordModal.error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {forgotPasswordModal.error}
                  </div>
                )}

                {forgotPasswordModal.success && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {forgotPasswordModal.success}
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <div className="login-form-group">
                    <label className="login-label">Phone Number</label>
                    <div className="login-input-wrapper">
                      <User size={18} className="login-input-icon" />
                      <input
                        type="tel"
                        value={forgotPasswordModal.phone}
                        onChange={(e) => setForgotPasswordModal((prev) => ({ ...prev, phone: e.target.value, error: "", success: "" }))}
                        placeholder="10-digit phone number"
                        className="login-input"
                        disabled={forgotPasswordModal.loading}
                        maxLength="10"
                      />
                    </div>
                  </div>

                  {forgotPasswordModal.step === "reset" && (
                    <>
                      <div className="login-form-group">
                        <label className="login-label">WhatsApp OTP</label>
                        <div className="login-input-wrapper">
                          <Lock size={18} className="login-input-icon" />
                          <input
                            type="text"
                            value={forgotPasswordModal.otp}
                            onChange={(e) => setForgotPasswordModal((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, "").slice(0, 6), error: "", success: prev.success }))}
                            placeholder="Enter 6-digit OTP"
                            className="login-input"
                            disabled={forgotPasswordModal.loading}
                            maxLength="6"
                          />
                        </div>
                      </div>

                      <div className="login-form-group">
                        <label className="login-label">New Password</label>
                        <div className="login-input-wrapper">
                          <Lock size={18} className="login-input-icon" />
                          <input
                            type="password"
                            value={forgotPasswordModal.newPassword}
                            onChange={(e) => setForgotPasswordModal((prev) => ({ ...prev, newPassword: e.target.value, error: "", success: prev.success }))}
                            placeholder="Minimum 6 characters"
                            className="login-input"
                            disabled={forgotPasswordModal.loading}
                          />
                        </div>
                      </div>

                      <div className="login-form-group">
                        <label className="login-label">Confirm New Password</label>
                        <div className="login-input-wrapper">
                          <Lock size={18} className="login-input-icon" />
                          <input
                            type="password"
                            value={forgotPasswordModal.confirmPassword}
                            onChange={(e) => setForgotPasswordModal((prev) => ({ ...prev, confirmPassword: e.target.value, error: "", success: prev.success }))}
                            placeholder="Confirm new password"
                            className="login-input"
                            disabled={forgotPasswordModal.loading}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  {forgotPasswordModal.step === "reset" && (
                    <button
                      type="button"
                      onClick={requestPasswordResetOtp}
                      disabled={forgotPasswordModal.loading}
                      className="rounded-xl bg-slate-200 px-4 py-2 font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-60"
                    >
                      Resend OTP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={forgotPasswordModal.step === "request" ? requestPasswordResetOtp : submitPasswordReset}
                    disabled={forgotPasswordModal.loading}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {forgotPasswordModal.loading
                      ? "Please wait..."
                      : forgotPasswordModal.step === "request"
                      ? "Send OTP"
                      : "Reset Password"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="login-footer">
            <p>Secure & Verified Platform • 24/7 Support</p>
          </div>
        </div>
      </div>
    </div>
  );
}
