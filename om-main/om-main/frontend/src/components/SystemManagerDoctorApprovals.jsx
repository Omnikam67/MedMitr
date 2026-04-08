import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  FileText,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  XCircle,
} from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/api';

export function SystemManagerDoctorApprovals({ managerId, onLogout, onBack }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, doctorId: null, doctorName: '', reason: '' });

  const loadPendingDoctors = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/doctor/manager/pending-registrations`, {
        manager_id: managerId,
      });
      setDoctors(res.data.registrations || []);
      setError('');
    } catch (err) {
      console.error('Failed to load pending doctors:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to load pending doctor registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingDoctors();
  }, [managerId]);

  const pendingMetrics = useMemo(
    () => ({
      total: doctors.length,
      specialties: new Set(doctors.map((doctor) => doctor.specialty).filter(Boolean)).size,
      avgExperience: doctors.length
        ? Math.round(doctors.reduce((sum, doctor) => sum + Number(doctor.experience_years || 0), 0) / doctors.length)
        : 0,
    }),
    [doctors]
  );

  const handleApprove = async (doctorId) => {
    setActionLoadingId(doctorId);
    try {
      const res = await axios.post(`${API_BASE}/doctor/manager/approve`, {
        doctor_id: doctorId,
        manager_id: managerId,
        approved: true,
        reason: 'Approved by system manager',
      });

      if (res.data.success) {
        setError('');
        await loadPendingDoctors();
      } else {
        setError(res.data.message || 'Failed to approve doctor');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve doctor');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (doctor) => {
    setRejectModal({
      open: true,
      doctorId: doctor.id,
      doctorName: doctor.name,
      reason: '',
    });
    setError('');
  };

  const submitReject = async () => {
    if (!rejectModal.reason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setActionLoadingId(rejectModal.doctorId);
    try {
      const res = await axios.post(`${API_BASE}/doctor/manager/approve`, {
        doctor_id: rejectModal.doctorId,
        manager_id: managerId,
        approved: false,
        reason: rejectModal.reason.trim(),
      });

      if (res.data.success) {
        setError('');
        setRejectModal({ open: false, doctorId: null, doctorName: '', reason: '' });
        await loadPendingDoctors();
      } else {
        setError(res.data.message || 'Failed to reject doctor');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject doctor');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="app-shell px-4 py-5 md:px-6">
      <div className="app-container space-y-6">
        <header className="app-hero rounded-[30px] px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {onBack && (
                <button onClick={onBack} className="mb-3 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Back to Manager Panel
                </button>
              )}
              <p className="app-eyebrow">Manager Queue</p>
              <h1 className="app-section-title mt-3">Doctor Registration Approvals</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Review credentials, specialty fit, and clinic details before approving a doctor into the network.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadPendingDoctors}
                disabled={loading}
                className="app-btn-secondary rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={16} />
                  {loading ? 'Refreshing...' : 'Refresh'}
                </span>
              </button>
              <button onClick={onLogout} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700">
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="app-stat-card px-5 py-5">
            <p className="app-kicker">Pending Requests</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-blue-600">{pendingMetrics.total}</p>
          </div>
          <div className="app-stat-card px-5 py-5">
            <p className="app-kicker">Specialties</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-cyan-600">{pendingMetrics.specialties}</p>
          </div>
          <div className="app-stat-card px-5 py-5">
            <p className="app-kicker">Avg Experience</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-emerald-600">{pendingMetrics.avgExperience} yrs</p>
          </div>
        </section>

        <section className="app-soft-section p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="app-kicker">Verification</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Pending Doctor Applications</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
              <ShieldCheck size={16} />
              Manual review required
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="app-empty mt-6 rounded-[26px] p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">No pending doctor registrations</p>
              <p className="mt-2 text-sm text-slate-500">All doctor applications have already been reviewed.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="app-list-card p-5 md:p-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                          <Stethoscope size={22} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tight text-slate-900">{doctor.name}</h3>
                          <p className="mt-1 text-sm font-semibold text-blue-600">{doctor.specialty}</p>
                          <p className="mt-1 text-xs text-slate-500">Doctor ID: {doctor.doctor_id}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pending</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="app-kicker">Contact</p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Mail size={14} />
                          {doctor.email}
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Phone size={14} />
                          {doctor.phone}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="app-kicker">Professional</p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <FileText size={14} />
                          {doctor.qualification}
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <UserRound size={14} />
                          {doctor.experience_years} years experience
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                      <p className="app-kicker">Clinic & Registration Details</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><span className="font-semibold text-slate-900">Clinic/Hospital:</span> {doctor.hospital_name || doctor.clinic_name || 'Not provided'}</p>
                        <p><span className="font-semibold text-slate-900">Address:</span> {doctor.address || doctor.clinic_address || 'Not provided'}</p>
                        <p><span className="font-semibold text-slate-900">Gender:</span> {doctor.gender}</p>
                        <p><span className="font-semibold text-slate-900">Consultation Fee:</span> Rs {doctor.appointment_fee || 0}</p>
                        <p><span className="font-semibold text-slate-900">Applied On:</span> {doctor.created_at ? new Date(doctor.created_at).toLocaleDateString() : 'Unknown'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleApprove(doctor.id)}
                        disabled={actionLoadingId === doctor.id}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionLoadingId === doctor.id ? 'Processing...' : 'Approve Doctor'}
                      </button>
                      <button
                        onClick={() => openRejectModal(doctor)}
                        disabled={actionLoadingId === doctor.id}
                        className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {rejectModal.open && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
              <p className="app-kicker">Rejection Reason</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Reject Dr. {rejectModal.doctorName}</h3>
              <p className="mt-2 text-sm text-slate-600">
                Add a clear reason so the applicant and manager history both reflect the decision properly.
              </p>
              <textarea
                rows={5}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Missing license proof, incomplete clinic details, verification failed..."
              />
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setRejectModal({ open: false, doctorId: null, doctorName: '', reason: '' })}
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Close
                </button>
                <button
                  onClick={submitReject}
                  disabled={actionLoadingId === rejectModal.doctorId}
                  className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {actionLoadingId === rejectModal.doctorId ? 'Submitting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
