import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowLeft, CheckCircle2, History, Loader2, RefreshCw, XCircle } from "lucide-react";
import { API_BASE } from "../config/api";

const statusClasses = {
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

function StatusPill({ status }) {
  const normalized = String(status || "").toLowerCase();
  const label = normalized === "rejected" ? "Rejected" : "Approved";
  const Icon = normalized === "rejected" ? XCircle : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
        statusClasses[normalized] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function EmptyState({ label }) {
  return (
    <div className="py-12 text-center text-slate-500">
      <History size={34} className="mx-auto mb-3 text-slate-300" />
      No {label} history found.
    </div>
  );
}

function HistoryCard({ title, subtitle, items, loading, error, renderItem }) {
  return (
    <section className="app-soft-section p-6">
      <div className="mb-4">
        <p className="app-kicker">Review Log</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState label={title.toLowerCase()} />
      ) : (
        <div className="space-y-3">
          {items.map(renderItem)}
        </div>
      )}
    </section>
  );
}

export function SystemManagerRequestHistory({ managerId, onBack, onLogout }) {
  const [doctorHistory, setDoctorHistory] = useState([]);
  const [pharmacistHistory, setPharmacistHistory] = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorError, setDoctorError] = useState("");
  const [pharmacistError, setPharmacistError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");

  const counts = useMemo(() => {
    const all = [...doctorHistory, ...pharmacistHistory, ...deliveryHistory];
    return {
      total: all.length,
      approved: all.filter((item) => String(item.status).toLowerCase() === "approved").length,
      rejected: all.filter((item) => String(item.status).toLowerCase() === "rejected").length,
    };
  }, [doctorHistory, pharmacistHistory, deliveryHistory]);

  const loadHistory = async () => {
    setLoading(true);
    setDoctorError("");
    setPharmacistError("");
    setDeliveryError("");

    const [doctorRes, pharmacistRes, deliveryRes] = await Promise.allSettled([
      axios.post(`${API_BASE}/doctor/manager/history`, {
        manager_id: managerId,
      }),
      axios.post(`${API_BASE}/auth/system-manager/pharmacist-history`, {
        manager_id: managerId,
      }),
      axios.post(`${API_BASE}/delivery/manager/history`, {
        manager_id: managerId,
      }),
    ]);

    if (doctorRes.status === "fulfilled") {
      setDoctorHistory(doctorRes.value.data?.registrations || []);
    } else {
      setDoctorError(doctorRes.reason?.response?.data?.detail || doctorRes.reason?.message || "Failed to load doctor history");
    }

    if (pharmacistRes.status === "fulfilled") {
      setPharmacistHistory(pharmacistRes.value.data?.requests || []);
    } else {
      setPharmacistError(pharmacistRes.reason?.response?.data?.detail || pharmacistRes.reason?.message || "Failed to load pharmacist history");
    }

    if (deliveryRes.status === "fulfilled") {
      setDeliveryHistory(deliveryRes.value.data?.requests || []);
    } else {
      setDeliveryError(deliveryRes.reason?.response?.data?.detail || deliveryRes.reason?.message || "Failed to load delivery boy history");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!managerId) return;
    loadHistory();
  }, [managerId]);

  return (
    <div className="app-shell px-4 py-5 md:px-6">
      <div className="app-container space-y-6">
        <header className="app-hero rounded-[30px] px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 mb-3"
            >
              <ArrowLeft size={16} />
              Back to Manager Panel
            </button>
            <p className="app-eyebrow">Manager Overview</p>
            <h1 className="app-section-title mt-3">System Manager History</h1>
            <p className="text-slate-600 text-base mt-1">See approved and rejected doctor, pharmacist, and delivery boy requests.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadHistory}
              className="app-btn-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={onLogout}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Logout
            </button>
          </div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="app-stat-card p-5">
            <div className="app-kicker">Total reviewed</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{counts.total}</div>
          </div>
          <div className="app-stat-card p-5">
            <div className="app-kicker">Approved</div>
            <div className="mt-2 text-3xl font-black text-emerald-600">{counts.approved}</div>
          </div>
          <div className="app-stat-card p-5">
            <div className="app-kicker">Rejected</div>
            <div className="mt-2 text-3xl font-black text-rose-600">{counts.rejected}</div>
          </div>
        </section>

        <HistoryCard
          title="Doctor Request History"
          subtitle="All reviewed doctor registration requests."
          items={doctorHistory}
          loading={loading}
          error={doctorError}
          renderItem={(item) => (
            <div key={item.id} className="app-list-card p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-tight text-slate-900">{item.name}</div>
                  <div className="text-sm text-slate-600">Doctor ID: {item.doctor_id}</div>
                  <div className="text-sm text-slate-600">Specialty: {item.specialty}</div>
                  <div className="text-sm text-slate-600">Phone: {item.phone}</div>
                  <div className="text-sm text-slate-600">Email: {item.email}</div>
                  <div className="text-xs text-slate-500 mt-2">Requested: {formatDate(item.created_at)}</div>
                  <div className="text-xs text-slate-500">Reviewed: {formatDate(item.reviewed_at)}</div>
                  {item.review_notes && (
                    <div className="mt-2 text-sm text-slate-700">Reason: {item.review_notes}</div>
                  )}
                </div>
                <StatusPill status={item.status} />
              </div>
            </div>
          )}
        />

        <HistoryCard
          title="Pharmacist Request History"
          subtitle="All reviewed pharmacist signup requests."
          items={pharmacistHistory}
          loading={loading}
          error={pharmacistError}
          renderItem={(item) => (
            <div key={item.request_id} className="app-list-card p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-tight text-slate-900">{item.store_name || item.name}</div>
                  <div className="text-sm text-slate-600">Owner: {item.owner_name || item.name}</div>
                  <div className="text-sm text-slate-600">Pharma ID: {item.pharma_id || item.shop_id}</div>
                  <div className="text-sm text-slate-600">Phone: {item.mobile_number || item.phone}</div>
                  <div className="text-sm text-slate-600">Email: {item.email}</div>
                  <div className="text-xs text-slate-500 mt-2">Requested: {formatDate(item.created_at)}</div>
                  <div className="text-xs text-slate-500">Reviewed: {formatDate(item.decided_at)}</div>
                </div>
                <StatusPill status={item.status} />
              </div>
            </div>
          )}
        />

        <HistoryCard
          title="Delivery Boy Request History"
          subtitle="All reviewed delivery partner requests."
          items={deliveryHistory}
          loading={loading}
          error={deliveryError}
          renderItem={(item) => (
            <div key={item.id} className="app-list-card p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-tight text-slate-900">{item.name}</div>
                  <div className="text-sm text-slate-600">Phone: {item.phone}</div>
                  <div className="text-sm text-slate-600">Age: {item.age}</div>
                  <div className="text-sm text-slate-600">Gender: {item.gender}</div>
                  <div className="text-xs text-slate-500 mt-2">Requested: {formatDate(item.created_at)}</div>
                  <div className="text-xs text-slate-500">Reviewed: {formatDate(item.approved_at)}</div>
                  {item.rejection_reason && (
                    <div className="mt-2 text-sm text-slate-700">Reason: {item.rejection_reason}</div>
                  )}
                </div>
                <StatusPill status={item.status} />
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
