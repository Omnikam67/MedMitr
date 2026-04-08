import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  DollarSign,
  History,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Star,
  Stethoscope,
  Upload,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/api';

export function BookAppointment({ onBack, currentUser }) {
  const initialPhone = currentUser?.phone || '';
  const initialName = currentUser?.name || '';

  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [loadingTrustedContacts, setLoadingTrustedContacts] = useState(false);
  const [step, setStep] = useState('dashboard');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [formData, setFormData] = useState({
    patient_name: initialName,
    patient_phone: initialPhone,
    patient_age: currentUser?.age ? String(currentUser.age) : '',
    patient_gender: '',
    appointment_date: '',
    appointment_time: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorProfile, setDoctorProfile] = useState({
    open: false,
    doctor: null,
    reviews: [],
    trustedReviewCount: 0,
    summary: null,
    loading: false,
  });
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    appointment: null,
    rating: 5,
    review_title: '',
    review_text: '',
    would_recommend: true,
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [trustedContactsText, setTrustedContactsText] = useState('');
  const [trustedContactsFileName, setTrustedContactsFileName] = useState('');
  const [importingTrustedContacts, setImportingTrustedContacts] = useState(false);

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      patient_name: prev.patient_name || currentUser.name || '',
      patient_phone: prev.patient_phone || currentUser.phone || '',
      patient_age: prev.patient_age || (currentUser.age ? String(currentUser.age) : ''),
    }));
  }, [currentUser]);

  const loadAppointmentHistory = useCallback(async (patientPhone) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_BASE}/doctor/appointment-history/${patientPhone}`);
      setAppointments(res.data.appointments || []);
    } catch (err) {
      console.error('Failed to load appointment history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadReferrals = useCallback(async (patientPhone) => {
    setLoadingReferrals(true);
    try {
      const res = await axios.get(`${API_BASE}/doctor/referrals/patient/${patientPhone}`);
      setReferrals(res.data.referrals || []);
    } catch (err) {
      console.error('Failed to load referrals:', err);
    } finally {
      setLoadingReferrals(false);
    }
  }, []);

  const normalizePhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const parseTrustedContacts = (rawText) => {
    const items = String(rawText || '')
      .split(/[\n,\r;\t ]+/)
      .map((value) => normalizePhone(value))
      .filter((value) => value.length === 10);
    return Array.from(new Set(items));
  };

  const loadTrustedContacts = useCallback(async () => {
    if (!currentUser?.id) {
      setTrustedContacts([]);
      return;
    }
    setLoadingTrustedContacts(true);
    try {
      const res = await axios.get(`${API_BASE}/auth/contacts/${currentUser.id}`);
      setTrustedContacts(res.data.contacts || []);
    } catch (err) {
      console.error('Failed to load trusted contacts:', err);
    } finally {
      setLoadingTrustedContacts(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadTrustedContacts();
  }, [loadTrustedContacts]);

  const refreshDashboardData = useCallback(async () => {
    const phone = (formData.patient_phone || currentUser?.phone || '').trim();
    if (phone.replace(/\D/g, '').length < 10) {
      setAppointments([]);
      setReferrals([]);
      return;
    }

    await Promise.all([loadAppointmentHistory(phone), loadReferrals(phone)]);
  }, [currentUser?.phone, formData.patient_phone, loadAppointmentHistory, loadReferrals]);

  useEffect(() => {
    refreshDashboardData();
  }, [refreshDashboardData]);

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await axios.get(`${API_BASE}/doctor/available`);
      setDoctors(res.data.doctors || []);
    } catch (err) {
      console.error('Failed to load doctors:', err);
      setError('Failed to load available doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: appointments.length,
      pending: appointments.filter((item) => item.status === 'pending').length,
      approved: appointments.filter((item) => item.status === 'approved').length,
      completed: appointments.filter((item) => item.status === 'completed').length,
      cancelled: appointments.filter((item) => item.status === 'cancelled').length,
    }),
    [appointments]
  );

  const filteredDoctors = useMemo(() => {
    const query = doctorSearch.trim().toLowerCase();
    if (!query) {
      return doctors;
    }
    return doctors.filter((doctor) =>
      [doctor.name, doctor.specialty, doctor.clinic_name, doctor.hospital_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [doctorSearch, doctors]);

  const getReferralStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'booked':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const formatStatus = (value) => {
    const normalized = String(value || '').replace('_', ' ');
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Pending';
  };

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedReferral(null);
    setStep('book-appointment');
    setError('');
  };

  const handleBookReferral = (referral) => {
    setSelectedDoctor({
      id: referral.to_doctor_id,
      name: referral.to_doctor_name,
      specialty: referral.to_doctor_specialty,
    });
    setSelectedReferral(referral);
    setFormData((prev) => ({
      ...prev,
      patient_name: referral.patient_name || prev.patient_name,
      patient_phone: referral.patient_phone || prev.patient_phone,
      patient_age: referral.patient_age ? String(referral.patient_age) : prev.patient_age,
      patient_gender: referral.patient_gender || prev.patient_gender,
      appointment_date: '',
      appointment_time: '',
      notes: referral.clinical_notes || '',
    }));
    setStep('book-appointment');
    setError('');
    setSuccess('');
  };

  const openDoctorProfile = async (doctor) => {
    setDoctorProfile({ open: true, doctor, reviews: [], trustedReviewCount: 0, summary: null, loading: true });
    try {
      const params = currentUser?.id ? { viewer_user_id: currentUser.id } : {};
      const [reviewsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE}/doctor/feedback/doctor/${doctor.id}`, { params }),
        axios.get(`${API_BASE}/doctor/feedback/summary/${doctor.id}`, { params }),
      ]);
      setDoctorProfile({
        open: true,
        doctor,
        reviews: reviewsRes.data.reviews || [],
        trustedReviewCount: reviewsRes.data.trusted_review_count || 0,
        summary: summaryRes.data.summary || null,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load doctor reviews:', err);
      setDoctorProfile({
        open: true,
        doctor,
        reviews: [],
        trustedReviewCount: 0,
        summary: null,
        loading: false,
      });
    }
  };

  const openFeedbackModal = (appointment) => {
    setFeedbackModal({
      open: true,
      appointment,
      rating: 5,
      review_title: '',
      review_text: '',
      would_recommend: true,
    });
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTrustedContactsFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTrustedContactsText(String(reader.result || ''));
      setTrustedContactsFileName(file.name);
      setError('');
      setSuccess('');
    };
    reader.readAsText(file);
  };

  const handleTrustedContactsImport = async () => {
    if (!currentUser?.id) {
      setError('Please login as a user to import trusted contacts.');
      return;
    }
    const contacts = parseTrustedContacts(trustedContactsText);
    if (contacts.length === 0) {
      setError('Add at least one valid 10-digit phone number for trusted contacts.');
      return;
    }

    setImportingTrustedContacts(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/contacts/import`, {
        user_id: currentUser.id,
        contacts,
      });
      if (!res.data.success) {
        setError(res.data.message || 'Failed to import trusted contacts.');
        return;
      }
      setSuccess(`Trusted contacts updated. ${res.data.count || contacts.length} numbers saved.`);
      setTrustedContactsText('');
      setTrustedContactsFileName('');
      await loadTrustedContacts();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to import trusted contacts.');
    } finally {
      setImportingTrustedContacts(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patient_name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!formData.patient_phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!formData.patient_age) {
      setError('Please enter your age');
      return;
    }
    if (!formData.patient_gender) {
      setError('Please select your gender');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        doctor_id: selectedDoctor.id,
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone,
        patient_age: parseInt(formData.patient_age, 10),
        patient_gender: formData.patient_gender,
        appointment_date: formData.appointment_date || null,
        appointment_time: formData.appointment_time || null,
        notes: formData.notes || null,
      };
      const res = selectedReferral
        ? await axios.post(`${API_BASE}/doctor/referrals/book`, {
            ...payload,
            referral_id: selectedReferral.id,
          })
        : await axios.post(`${API_BASE}/doctor/appointment/create`, payload);

      if (!res.data.success) {
        setError(res.data.message || 'Failed to submit appointment');
        return;
      }

      setSuccess(
        selectedReferral
          ? 'Referred appointment booked successfully. The referred doctor will review it and update the status.'
          : 'Appointment request submitted successfully. The doctor will see it as pending and you will get WhatsApp confirmation after approval.'
      );
      await loadAppointmentHistory(formData.patient_phone);
      await loadReferrals(formData.patient_phone);
      setStep('dashboard');
      setSelectedDoctor(null);
      setSelectedReferral(null);
      setFormData((prev) => ({
        ...prev,
        appointment_date: '',
        appointment_time: '',
        notes: '',
      }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackModal.appointment?.feedback?.target_appointment_id) {
      setError('Feedback is not available for this treatment.');
      return;
    }

    setSubmittingFeedback(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/doctor/feedback/create`, {
        appointment_id: feedbackModal.appointment.id,
        patient_phone: formData.patient_phone || currentUser?.phone || '',
        rating: feedbackModal.rating,
        review_title: feedbackModal.review_title || null,
        review_text: feedbackModal.review_text || null,
        would_recommend: feedbackModal.rating >= 4,
      });

      if (!res.data.success) {
        setError(res.data.message || 'Failed to submit feedback');
        return;
      }

      setSuccess('Thank you. Your feedback has been submitted successfully.');
      setFeedbackModal({
        open: false,
        appointment: null,
        rating: 5,
        review_title: '',
        review_text: '',
        would_recommend: true,
      });
      await Promise.all([refreshDashboardData(), loadDoctors()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const renderStars = (rating, size = 16) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star
        key={`${rating}-${index}`}
        size={size}
        className={index < Math.round(rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
      />
    ));

  const getRecommendationLabel = (rate) => {
    if (rate >= 80) return 'Highly recommended';
    if (rate >= 60) return 'Strong recommendation';
    if (rate >= 40) return 'Mixed patient feedback';
    return 'Low recommendation';
  };

  const DoctorCard = ({ doctor }) => (
    <div
      className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition cursor-pointer h-full flex flex-col"
      onClick={() => handleSelectDoctor(doctor)}
    >
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-900">Dr. {doctor.name}</h3>
          <p className="text-blue-600 font-semibold text-sm mt-1">{doctor.specialty}</p>
        </div>
        <div className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ml-2">
          {doctor.experience_years} yrs
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">{renderStars(doctor.average_rating, 14)}</div>
          <span className="text-sm font-semibold text-slate-800">
            {doctor.review_count > 0 ? doctor.average_rating.toFixed(1) : 'New'}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {doctor.review_count} review{doctor.review_count === 1 ? '' : 's'}
          </p>
          {doctor.review_count > 0 && (
            <p className="mt-1 text-xs font-semibold text-emerald-700">{doctor.recommendation_rate}% recommend</p>
          )}
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {doctor.appointment_fee && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="text-slate-600 font-medium text-sm">Consultation Fee</p>
            <p className="text-green-700 font-bold text-lg flex items-center gap-1">
              <DollarSign size={18} />
              Rs {doctor.appointment_fee}
            </p>
          </div>
        )}

        {doctor.clinic_name && (
          <div className="flex items-start gap-2 text-slate-600 text-sm">
            <MapPin size={16} className="mt-0.5 flex-shrink-0" />
            <span>{doctor.clinic_name}</span>
          </div>
        )}

        {doctor.phone && (
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <Phone size={16} />
            <span>{doctor.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDoctorProfile(doctor);
          }}
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View Profile
        </button>
        <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          Book Appointment
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,_#f5fbff_0%,_#e9f4ff_45%,_#f8fbff_100%)] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-5 inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-300/40 transition hover:bg-slate-800"
        >
          Back
        </button>

        {error && <div className="mb-4 p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg">{error}</div>}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {step === 'dashboard' && (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[32px] border border-sky-100 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(239,248,255,0.94))] p-6 shadow-[0_24px_80px_-34px_rgba(15,23,42,0.28)] md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Appointments</p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                    Appointment Dashboard
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                    Track appointments, referrals, prescriptions, and feedback in one full-page dashboard that matches the rest of your product.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {currentUser?.id && (
                    <button
                      onClick={() => setStep('trusted-contacts')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <Users size={18} />
                      Add Contact
                    </button>
                  )}
                  <button
                    onClick={() => setStep('select-doctor')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-cyan-600"
                  >
                    <Stethoscope size={20} />
                    Show Available Doctors
                  </button>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <History size={16} />
                    Total
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-blue-600">{summary.total}</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-white/90 px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Clock size={16} />
                    Pending
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-amber-500">{summary.pending}</div>
                </div>
                <div className="rounded-2xl border border-green-100 bg-white/90 px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <CheckCircle size={16} />
                    Approved
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-green-600">{summary.approved}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Calendar size={16} />
                    Completed
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-emerald-600">{summary.completed}</div>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-white/90 px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <XCircle size={16} />
                    Cancelled
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-rose-600">{summary.cancelled}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.25)] md:p-6">
              <div className="mb-5">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">Your Recent Appointments</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Your recent appointments, notes, prescriptions, and specialist handoffs appear here in one timeline.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {loadingHistory ? (
                  <p className="text-slate-500">Loading appointment history...</p>
                ) : appointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    No appointments found yet. Use "Show Available Doctors" to book one.
                  </div>
                ) : (
                  appointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/70 p-5 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.55)]">
                      {(() => {
                        const referralPrescription =
                          appointment.referral?.result_appointment?.prescription_medicines || [];
                        const showReferralPrescription = Boolean(appointment.referral) && referralPrescription.length > 0;
                        const primaryPrescription = showReferralPrescription
                          ? referralPrescription
                          : appointment.prescription_medicines || [];
                        const primaryDownloadId = showReferralPrescription
                          ? appointment.referral?.result_appointment?.id
                          : appointment.id;
                        const showPrimaryDownload = showReferralPrescription
                          ? Boolean(appointment.referral?.result_appointment?.has_prescription_image)
                          : Boolean(appointment.has_prescription_image);
                        const feedbackInfo = appointment.feedback || {};
                        const showFeedbackButton =
                          feedbackInfo.show_on_card && feedbackInfo.can_submit;
                        const showFeedbackSubmitted =
                          feedbackInfo.show_on_card && feedbackInfo.submitted;

                        return (
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-xl font-black tracking-tight text-slate-900">
                            Dr. {appointment.doctor_name || 'Doctor'}
                            </p>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {appointment.clinic_name || 'Clinic'}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Date</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800">{appointment.appointment_date || 'Not set'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Time</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800">{appointment.appointment_time || 'Not set'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800">{formatStatus(appointment.status)}</p>
                            </div>
                          </div>
                          {appointment.notes && (
                            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">Notes</p>
                              <p className="mt-1 text-sm text-slate-700">{appointment.notes}</p>
                            </div>
                          )}
                          {appointment.referral && (
                            <div className="mt-4 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,_rgba(59,130,246,0.08),_rgba(14,165,233,0.03))] p-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-500">Referral Case</p>
                                  <p className="text-sm font-bold text-slate-900">
                                    Referral: Dr. {appointment.referral.from_doctor_name || 'Doctor'} <ArrowRight size={14} className="inline mx-1" />
                                    Dr. {appointment.referral.to_doctor_name || 'Doctor'}
                                  </p>
                                  <p className="text-sm text-slate-700">Reason: {appointment.referral.reason}</p>
                                  {appointment.referral.clinical_notes && (
                                    <p className="text-sm text-slate-700">Clinical notes: {appointment.referral.clinical_notes}</p>
                                  )}
                                  {appointment.referral.result_appointment?.status === 'completed' && (
                                    <p className="text-sm font-semibold text-emerald-700">
                                      Referred case completed by Dr. {appointment.referral.to_doctor_name || 'Doctor'}
                                    </p>
                                  )}
                                  {showFeedbackButton && (
                                    <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                                      <MessageSquare size={16} />
                                      Final specialist treatment completed. Please share your feedback for Dr. {appointment.feedback?.target_doctor_name || appointment.doctor_name || 'Doctor'}.
                                    </div>
                                  )}
                                  {showFeedbackSubmitted && (
                                    <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                                      <CheckCircle size={16} />
                                      Feedback shared for the completed specialist visit.
                                    </div>
                                  )}
                                </div>
                                <div className="flex min-w-[220px] flex-col gap-2">
                                  <span
                                    className={`inline-flex h-fit justify-center rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getReferralStatusClass(
                                      appointment.referral.status
                                    )}`}
                                  >
                                    {String(appointment.referral.status || '').replace('_', ' ')}
                                  </span>
                                  {appointment.referral.status === 'pending_booking' && (
                                    <button
                                      onClick={() => handleBookReferral(appointment.referral)}
                                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                                    >
                                      Book Referred Appointment
                                    </button>
                                  )}
                                  {appointment.referral.result_appointment?.status === 'completed' &&
                                    appointment.referral.result_appointment?.has_prescription_image &&
                                    appointment.referral.result_appointment?.prescription_medicines?.length > 0 && (
                                      <a
                                        href={`${API_BASE}/doctor/appointments/${appointment.referral.result_appointment.id}/prescription-download`}
                                        target="_blank"
                                        rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                                    >
                                      <Download size={16} />
                                      Referral Prescription
                                    </a>
                                    )}
                                </div>
                              </div>
                            </div>
                          )}
                          {primaryPrescription.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 text-sm text-emerald-900">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Prescription</p>
                              {primaryPrescription.map((medicine, index) => (
                                <div key={`${primaryDownloadId}-${index}`} className="rounded-xl bg-white/70 px-3 py-2">
                                  <p className="font-medium">{index + 1}. {medicine.medicine_name}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {(appointment.status === 'completed' && showPrimaryDownload) || showFeedbackButton || showFeedbackSubmitted ? (
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              {appointment.status === 'completed' && showPrimaryDownload && (
                                <a
                                  href={`${API_BASE}/doctor/appointments/${primaryDownloadId}/prescription-download`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                >
                                  <Download size={16} />
                                  {showReferralPrescription ? 'Download Referral Prescription' : 'Download Prescription'}
                                </a>
                              )}
                              {showFeedbackButton && (
                                <button
                                  type="button"
                                  onClick={() => openFeedbackModal(appointment)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
                                >
                                  <MessageSquare size={16} />
                                  Share Feedback
                                </button>
                              )}
                              {showFeedbackSubmitted && (
                                <span className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                                  <CheckCircle size={16} />
                                  Feedback Submitted
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex h-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
                            appointment.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : appointment.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : appointment.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {formatStatus(appointment.status)}
                        </span>
                      </div>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div id="referral-section" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.25)] md:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">Referred Consultations</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    When one doctor refers you to another, the referred specialist stays fixed and you can continue the case from here.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {loadingReferrals ? (
                  <p className="text-slate-500">Loading referrals...</p>
                ) : referrals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    No referrals found for this phone number yet.
                  </div>
                ) : (
                  referrals.map((referral) => (
                    <div key={referral.id} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/70 p-5 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.55)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-500">Referral Path</p>
                          <p className="text-lg font-black tracking-tight text-slate-900">
                            Dr. {referral.from_doctor_name || 'Doctor'} <ArrowRight size={16} className="inline mx-1" />
                            Dr. {referral.to_doctor_name || 'Doctor'}
                          </p>
                          <p className="text-sm text-slate-600">Reason: {referral.reason}</p>
                          {referral.clinical_notes && (
                            <p className="text-sm text-slate-700">Clinical notes: {referral.clinical_notes}</p>
                          )}
                          <p className="text-sm text-slate-600">
                            Status: <span className="font-semibold capitalize">{referral.status.replace('_', ' ')}</span>
                          </p>
                          {referral.result_appointment?.prescription_medicines?.length > 0 && (
                            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                              <p className="font-semibold text-emerald-800">Result Prescription</p>
                              {referral.result_appointment.prescription_medicines.map((medicine, index) => (
                                <p key={`${referral.id}-${index}`}>{index + 1}. {medicine.medicine_name}</p>
                              ))}
                            </div>
                          )}
                          {referral.result_appointment?.status === 'completed' && referral.result_appointment?.has_prescription_image && (
                            <a
                              href={`${API_BASE}/doctor/appointments/${referral.result_appointment.id}/prescription-download`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                            >
                              <Download size={16} />
                              Download Result Prescription
                            </a>
                          )}
                        </div>
                        <div className="flex min-w-[220px] flex-col gap-2">
                          {referral.status === 'pending_booking' && (
                            <button
                              onClick={() => handleBookReferral(referral)}
                              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                            >
                              Book Referred Appointment
                            </button>
                          )}
                          {referral.status !== 'pending_booking' && (
                            <span
                              className={`rounded-full px-3 py-2 text-center text-sm font-semibold capitalize ${getReferralStatusClass(
                                referral.status
                              )}`}
                            >
                              {formatStatus(referral.status)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'trusted-contacts' && currentUser?.id && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.25)] md:p-8">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  <Users size={14} />
                  Trusted Reviews
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Add Trusted Contacts</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add family and friends by phone number. When they review a doctor after treatment, their review appears first for you as a trusted review.
                </p>
              </div>
              <button
                onClick={() => setStep('dashboard')}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Dashboard
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Saved trusted contacts</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{trustedContacts.length}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {loadingTrustedContacts ? 'Refreshing trusted circle...' : 'Use line-separated or CSV/TXT contact imports for your laptop demo.'}
                  </p>
                </div>

                {trustedContacts.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current trusted numbers</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trustedContacts.map((contact) => (
                        <span key={contact.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                          {contact.contact_phone}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <textarea
                  rows={8}
                  value={trustedContactsText}
                  onChange={(e) => setTrustedContactsText(e.target.value)}
                  placeholder={'9876543210\n8888888888\n7777777777'}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    <Upload size={16} />
                    {trustedContactsFileName || 'Upload CSV/TXT'}
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleTrustedContactsFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleTrustedContactsImport}
                    disabled={importingTrustedContacts}
                    className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {importingTrustedContacts ? 'Importing...' : 'Save Trusted Contacts'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'select-doctor' && (
          <div>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Available Doctors</h2>
                <p className="mt-2 text-sm text-slate-600">Search by specialist type, open the profile, and review patient feedback before booking.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-[280px]">
                  <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Search heart specialist, clinic, or doctor"
                    className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => setStep('dashboard')}
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-white"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {loadingDoctors ? (
              <div className="text-center py-12 text-slate-500">Loading doctors...</div>
            ) : filteredDoctors.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No doctors available at the moment</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'book-appointment' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.25)] md:p-8">
            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => {
                  setStep('select-doctor');
                  setSelectedDoctor(null);
                }}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Change Doctor
              </button>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                {selectedReferral ? 'Booking Referred Appointment with' : 'Booking with'} Dr. {selectedDoctor?.name}
              </h2>
            </div>

            {selectedReferral && (
              <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900">
                <p className="font-semibold">
                  Referred by Dr. {selectedReferral.from_doctor_name || 'Doctor'} to Dr. {selectedReferral.to_doctor_name || 'Doctor'}
                </p>
                <p className="mt-1">Reason: {selectedReferral.reason}</p>
                {selectedReferral.clinical_notes && <p className="mt-1">Clinical notes: {selectedReferral.clinical_notes}</p>}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  name="patient_name"
                  value={formData.patient_name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  name="patient_phone"
                  value={formData.patient_phone}
                  onChange={handleInputChange}
                  placeholder="Enter your phone number"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Age *</label>
                  <input
                    type="number"
                    name="patient_age"
                    value={formData.patient_age}
                    onChange={handleInputChange}
                    placeholder="Age"
                    min="1"
                    max="120"
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Gender *</label>
                  <select
                    name="patient_gender"
                    value={formData.patient_gender}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Date</label>
                  <input
                    type="date"
                    name="appointment_date"
                    value={formData.appointment_date}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Time</label>
                  <input
                    type="time"
                    name="appointment_time"
                    value={formData.appointment_time}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any additional information..."
                  rows="4"
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                {submitting ? 'Submitting...' : 'Submit Appointment Request'}
              </button>
            </form>
          </div>
        )}

        {doctorProfile.open && doctorProfile.doctor && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-500">Doctor Profile</p>
                  <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Dr. {doctorProfile.doctor.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-blue-600">{doctorProfile.doctor.specialty}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <span>{doctorProfile.doctor.experience_years} years experience</span>
                    {doctorProfile.doctor.clinic_name && <span>{doctorProfile.doctor.clinic_name}</span>}
                    {doctorProfile.doctor.hospital_name && <span>{doctorProfile.doctor.hospital_name}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDoctorProfile({ open: false, doctor: null, reviews: [], trustedReviewCount: 0, summary: null, loading: false })}
                  className="self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">Average Rating</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-1">{renderStars(doctorProfile.doctor.average_rating, 18)}</div>
                    <span className="text-2xl font-black text-slate-900">
                      {doctorProfile.doctor.review_count > 0 ? doctorProfile.doctor.average_rating.toFixed(1) : 'New'}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">Patient Reviews</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{doctorProfile.doctor.review_count}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Trust Signal</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">
                    {doctorProfile.summary?.trusted_review_count || 0}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">
                    {doctorProfile.summary?.trusted_review_count
                      ? "Trusted circle reviews found"
                      : getRecommendationLabel(doctorProfile.doctor.recommendation_rate || 0)}
                  </p>
                </div>
              </div>

              {doctorProfile.trustedReviewCount > 0 && (
                <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                  <p className="font-semibold">
                    {doctorProfile.trustedReviewCount} review{doctorProfile.trustedReviewCount === 1 ? '' : 's'} from your trusted circle found for this doctor.
                  </p>
                  <p className="mt-1 text-sky-700">
                    Trusted reviews are shown first and reviewer identity stays private.
                  </p>
                  {!!doctorProfile.summary?.trusted_average_rating && (
                    <p className="mt-2 text-sky-700">
                      Trusted-circle average rating: {doctorProfile.summary.trusted_average_rating.toFixed(1)}/5
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-slate-900">Patient Reviews</h4>
                    <p className="mt-1 text-sm text-slate-600">Patients can review doctors only after a completed treatment.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectDoctor(doctorProfile.doctor)}
                    className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Book Appointment
                  </button>
                </div>

                {doctorProfile.loading ? (
                  <p className="text-sm text-slate-500">Loading reviews...</p>
                ) : doctorProfile.reviews.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                    No reviews yet for this doctor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {doctorProfile.reviews.map((review) => (
                      <div key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-lg font-black tracking-tight text-slate-900">
                              {review.reviewer_label || review.patient_name || 'Verified patient'}
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">{renderStars(review.rating, 14)}</div>
                              <span className="text-sm font-semibold text-slate-800">{review.rating}.0</span>
                              {review.is_trusted_contact_review && (
                                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                  Trusted Contact
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-700">{review.review_title || 'Verified patient review'}</p>
                          </div>
                          <span className="text-xs font-medium text-slate-500">
                            {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        {review.review_text && <p className="mt-3 text-sm leading-6 text-slate-700">{review.review_text}</p>}
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Rated this doctor {review.rating}/5
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {feedbackModal.open && feedbackModal.appointment && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600">Treatment Feedback</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    Review Dr. {feedbackModal.appointment.feedback?.target_doctor_name || feedbackModal.appointment.doctor_name || 'Doctor'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Share your treatment experience so future patients can choose the right specialist with confidence.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackModal({ open: false, appointment: null, rating: 5, review_title: '', review_text: '', would_recommend: true })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSubmitFeedback} className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Rating</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFeedbackModal((prev) => ({ ...prev, rating: value }))}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          feedbackModal.rating === value
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Star size={16} className={feedbackModal.rating >= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Review title</label>
                  <input
                    type="text"
                    value={feedbackModal.review_title}
                    onChange={(e) => setFeedbackModal((prev) => ({ ...prev, review_title: e.target.value }))}
                    placeholder="Helpful specialist care"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Your review</label>
                  <textarea
                    rows={5}
                    value={feedbackModal.review_text}
                    onChange={(e) => setFeedbackModal((prev) => ({ ...prev, review_text: e.target.value }))}
                    placeholder="Tell other patients how the treatment, communication, and consultation experience felt."
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-800">
                    Recommendation score from your stars: {feedbackModal.rating * 20}%
                  </p>
                  <p className="mt-1 text-slate-600">
                    Each star contributes 20%. Lower stars reduce the doctor&apos;s recommendation rate and higher stars improve it.
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 opacity-70">
                  <input
                    type="checkbox"
                    checked={feedbackModal.rating >= 4}
                    readOnly
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Recommended status is now set automatically from the star rating.
                </label>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedbackModal({ open: false, appointment: null, rating: 5, review_title: '', review_text: '', would_recommend: true })}
                    className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
