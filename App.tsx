import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  Mail,
  Phone,
  Lock,
  ChevronRight,
  CheckCircle2,
  Wifi,
  Zap,
  MessageSquare,
  Loader2,
  Database,
  ShoppingCart,
  Copy,
  Info,
  AlertTriangle,
  ShieldAlert,
  Globe,
  XCircle,
  RefreshCw,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import Input from "./components/Input";
import { RegistrationPayload, UsageResponse } from "./types";
import { DEFAULT_PLAN_UUID } from "./constants";
import {
  registerUser,
  requestOtp,
  verifyOtp,
  loginUser,
  getUsage,
} from "./services/api";

type Step = "REGISTRATION" | "OTP_VERIFY" | "LOGIN" | "USAGE_INFO" | "SUCCESS";

interface DomainStatus {
  domain: string;
  label: string;
  status: "checking" | "ok" | "blocked";
}

const App: React.FC = () => {
  const [step, setStep] = useState<Step>("LOGIN");
  const [formData, setFormData] = useState<RegistrationPayload>({
    username: "",
    email: "",
    password1: "",
    password2: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    method: "mobile_phone",
    plan_pricing: DEFAULT_PLAN_UUID,
  });

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [usageData, setUsageData] = useState<{
    remainingMB: string;
    hasData: boolean;
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [showHelper, setShowHelper] = useState(true);

  const [diagnostics, setDiagnostics] = useState<DomainStatus[]>([
    { domain: "corsproxy.io", label: "CORS Bridge", status: "checking" },
    { domain: "device.onetel.co.za", label: "Auth Server", status: "checking" },
    { domain: "esm.sh", label: "App Core", status: "checking" },
    {
      domain: "tmanscript.github.io",
      label: "Portal Host",
      status: "checking",
    },
  ]);

  const [uamParams, setUamParams] = useState({
    uamip: "192.168.182.1",
    uamport: "3990",
    challenge: "",
  });

  const runDiagnostics = useCallback(async () => {
    setDiagnostics((prev) => prev.map((d) => ({ ...d, status: "checking" })));

    const tests = diagnostics.map(async (d) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        await fetch(`https://${d.domain}/`, {
          mode: "no-cors",
          signal: controller.signal,
          cache: "no-cache",
        });
        clearTimeout(timeoutId);
        return { ...d, status: "ok" as const };
      } catch (e) {
        return { ...d, status: "blocked" as const };
      }
    });

    const results = await Promise.all(tests);
    setDiagnostics(results);
  }, []);

  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(runDiagnostics, 45000);
    return () => clearInterval(interval);
  }, [runDiagnostics]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginUrl = params.get("loginurl");
    let targetParams = params;

    if (loginUrl) {
      try {
        const decodedUrl = new URL(decodeURIComponent(loginUrl));
        targetParams = decodedUrl.searchParams;
      } catch (e) {}
    }

    const uamip =
      targetParams.get("uamip") || params.get("uamip") || "192.168.182.1";
    const uamport =
      targetParams.get("uamport") || params.get("uamport") || "3990";
    const challenge =
      targetParams.get("challenge") || params.get("challenge") || "";

    setUamParams({ uamip, uamport, challenge });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "username" || name === "phone_number") {
      const sanitized = value.trim();
      setFormData((prev) => ({
        ...prev,
        username: sanitized,
        phone_number: sanitized,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const parseResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { detail: text || `Status ${response.status}` };
    }
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password1 !== formData.password2) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setIsNetworkError(false);

    try {
      const response = await registerUser(formData);
      const data = await parseResponse(response);

      if (response.ok) {
        const token = data.token || data.key || data.token_key;
        setAuthToken(token);
        // After registration, request an OTP
        await requestOtp(token);
        setStep("OTP_VERIFY");
      } else {
        setErrorMessage(
          data.detail ||
            data.username?.[0] ||
            "Registration failed. Check details.",
        );
      }
    } catch (err) {
      setIsNetworkError(true);
      setErrorMessage(
        "Network error during registration. Check router settings.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await verifyOtp(authToken, otpCode);
      const data = await parseResponse(response);

      if (response.ok) {
        // Automatically try to log in after OTP success
        setLoginData({
          username: formData.username,
          password: formData.password1,
        });
        setStep("LOGIN");
        setErrorMessage("Verification successful! Please sign in.");
      } else {
        setErrorMessage(data.detail || "Invalid code. Please try again.");
      }
    } catch (err) {
      setErrorMessage("Failed to verify OTP. Check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setIsNetworkError(false);

    try {
      const response = await loginUser(loginData);
      const data = await parseResponse(response);

      if (response.ok) {
        const token = data.token || data.key || data.token_key;
        setAuthToken(token);
        const usageRes = await getUsage(token);
        const usage: UsageResponse = await parseResponse(usageRes);

        if (usage.checks && usage.checks.length > 0) {
          const check = usage.checks[0];
          const remainingBytes = check.value - check.result;
          const remainingMB = (remainingBytes / (1024 * 1024)).toFixed(2);
          const hasData = remainingBytes > 1024 * 50;
          setUsageData({ remainingMB, hasData });
          setStep("USAGE_INFO");
        } else {
          setStep("SUCCESS");
        }
      } else {
        setErrorMessage(data.detail || "Incorrect phone number or password.");
      }
    } catch (err) {
      setIsNetworkError(true);
      setErrorMessage('Network error. Ensure "corsproxy.io" is allowed.');
      runDiagnostics();
    } finally {
      setIsSubmitting(false);
    }
  };

  const connectToRouter = () => {
    const loginUrl = `http://${uamParams.uamip}:${uamParams.uamport}/logon`;
    const form = document.createElement("form");
    form.method = "GET";
    form.action = loginUrl;
    form.appendChild(
      Object.assign(document.createElement("input"), {
        type: "hidden",
        name: "username",
        value: loginData.username,
      }),
    );
    form.appendChild(
      Object.assign(document.createElement("input"), {
        type: "hidden",
        name: "password",
        value: loginData.password,
      }),
    );
    document.body.appendChild(form);
    form.submit();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("List copied to clipboard!");
  };

  const WALLED_GARDEN =
    "device.onetel.co.za,corsproxy.io,tmanscript.github.io,github.io,esm.sh,cdn.tailwindcss.com,fonts.googleapis.com,fonts.gstatic.com,cdnjs.cloudflare.com,umoja.network.coova.org";

  const renderContent = () => {
    // Step: Registration
    if (step === "REGISTRATION") {
      return (
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100 animate-in fade-in duration-500">
          <div className="hidden lg:flex flex-col justify-between p-12 bg-pink-500 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400 opacity-20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div>
              <h2 className="text-4xl font-bold leading-tight mb-6">
                Join Onetel
              </h2>
              <p className="text-pink-100 font-medium opacity-90">
                Create your account to start enjoying high-speed internet access
                across our network coverage.
              </p>
            </div>
            <div className="relative z-10 bg-black/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-pink-100">
                Hotspot Status
              </p>
              <div className="grid grid-cols-2 gap-2">
                {diagnostics.map((d) => (
                  <div
                    key={d.domain}
                    className="flex items-center gap-2 text-[9px] font-bold"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${d.status === "ok" ? "bg-green-400" : "bg-red-400 animate-pulse"}`}
                    />
                    <span className="truncate">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-8 overflow-y-auto max-h-[85vh]">
            <button
              onClick={() => setStep("LOGIN")}
              className="flex items-center gap-2 text-pink-500 font-bold text-xs uppercase mb-6 hover:translate-x-[-4px] transition-transform"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </button>
            <h3 className="text-2xl font-bold mb-6 text-gray-900">
              Create Account
            </h3>
            <form onSubmit={handleRegistrationSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="John"
                  icon={<User className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Doe"
                  icon={<User className="w-4 h-4" />}
                  required
                />
              </div>
              <Input
                label="Phone Number"
                name="username"
                type="tel"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="+27..."
                icon={<Phone className="w-4 h-4" />}
                required
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                icon={<Mail className="w-4 h-4" />}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Password"
                  name="password1"
                  type="password"
                  value={formData.password1}
                  onChange={handleInputChange}
                  placeholder="••••••"
                  icon={<Lock className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Confirm"
                  name="password2"
                  type="password"
                  value={formData.password2}
                  onChange={handleInputChange}
                  placeholder="••••••"
                  icon={<Lock className="w-4 h-4" />}
                  required
                />
              </div>

              {errorMessage && (
                <div className="text-red-600 text-[11px] font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex gap-2 items-center">
                  <XCircle className="w-4 h-4" /> <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Register Account <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Step: OTP Verification
    if (step === "OTP_VERIFY") {
      return (
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 border border-pink-100 animate-in zoom-in duration-300">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-pink-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Verify Identity
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Enter the verification code sent to <br />
              <span className="font-bold text-gray-700">
                {formData.username}
              </span>
            </p>
          </div>
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <Input
              label="Verification Code"
              name="otp"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.5em] font-black"
              required
            />

            {errorMessage && (
              <div className="text-red-600 text-[11px] font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex gap-2 items-center">
                <XCircle className="w-4 h-4" /> <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Verify & Continue"
              )}
            </button>
          </form>
          <button
            onClick={() => setStep("REGISTRATION")}
            className="w-full mt-6 text-gray-400 font-bold text-xs uppercase hover:underline"
          >
            Incorrect Number? Change
          </button>
        </div>
      );
    }

    // Step: Authenticated / Usage Info
    if (step === "SUCCESS" || (step === "USAGE_INFO" && usageData?.hasData)) {
      return (
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-pink-500 animate-in zoom-in">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Authenticated!
          </h2>
          {usageData && (
            <div className="mb-6 p-4 bg-pink-50 rounded-2xl border border-pink-100">
              <p className="text-pink-600 font-bold text-lg">
                {usageData.remainingMB} MB Remaining
              </p>
              <p className="text-pink-400 text-xs uppercase tracking-widest font-black mt-1">
                Available Balance
              </p>
            </div>
          )}
          <p className="text-gray-600 mb-8 text-sm">
            Your account is ready. Click below to activate your high-speed
            internet session.
          </p>
          <button
            onClick={connectToRouter}
            className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            Activate Internet Now <Zap className="w-5 h-5" />
          </button>
        </div>
      );
    }

    // Step: No Data
    if (step === "USAGE_INFO" && !usageData?.hasData) {
      return (
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-orange-500 animate-in zoom-in">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center relative">
              <Database className="w-10 h-10 text-orange-500" />
              <div className="absolute top-0 right-0 w-6 h-6 bg-orange-500 rounded-full border-4 border-white flex items-center justify-center">
                <XCircle className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Data Depleted
          </h2>
          <div className="mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100">
            <p className="text-orange-600 font-bold text-lg">
              0.00 MB Remaining
            </p>
          </div>
          <p className="text-gray-500 mb-8 text-sm">
            Please purchase a top-up bundle to continue.
          </p>
          <div className="space-y-3">
            <button className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95">
              Buy Data Bundle <ShoppingCart className="w-5 h-5" />
            </button>
            <button
              onClick={() => setStep("LOGIN")}
              className="w-full py-3 text-gray-400 font-bold text-xs uppercase"
            >
              Switch Account
            </button>
          </div>
        </div>
      );
    }

    // Default Step: Login
    return (
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100">
        <div className="hidden lg:flex flex-col justify-between p-12 bg-pink-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400 opacity-20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold leading-tight mb-6">
              High Speed WiFi
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20">
                <CheckCircle2 className="w-5 h-5" />{" "}
                <span>Secured Authentication</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl border border-white/20">
                <CheckCircle2 className="w-5 h-5" />{" "}
                <span>Real-time Usage Balance</span>
              </div>
            </div>
          </div>
          <div className="relative z-10 bg-black/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-pink-100">
              System Health
            </p>
            <div className="grid grid-cols-2 gap-2">
              {diagnostics.map((d) => (
                <div
                  key={d.domain}
                  className="flex items-center gap-2 text-[9px] font-bold"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${d.status === "ok" ? "bg-green-400" : "bg-red-400 animate-pulse"}`}
                  />
                  <span className="truncate">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-12 flex flex-col justify-center bg-white">
          <h3 className="text-2xl font-bold mb-8 text-gray-900">
            Login to Onetel
          </h3>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Input
              label="Phone Number"
              name="username"
              type="tel"
              value={loginData.username}
              onChange={handleLoginChange}
              placeholder="+27..."
              icon={<Phone className="w-4 h-4" />}
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={loginData.password}
              onChange={handleLoginChange}
              placeholder="••••••"
              icon={<Lock className="w-4 h-4" />}
              required
            />

            {errorMessage && (
              <div className="text-red-600 text-[11px] font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex gap-2 items-center">
                <XCircle className="w-4 h-4" /> <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In & Connect <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          <button
            onClick={() => setStep("REGISTRATION")}
            className="w-full mt-6 text-pink-500 font-bold text-xs uppercase tracking-widest hover:underline"
          >
            Create New Account
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#fdf2f8]">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-pink-500 rounded-2xl shadow-xl mb-4 transform -rotate-2">
          <Wifi className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter">
          ONETEL<span className="text-pink-500">.</span>
        </h1>
      </div>

      {renderContent()}

      {showHelper && (
        <div className="mt-8 max-w-xl w-full bg-white border-2 border-pink-100 rounded-[2rem] p-6 shadow-xl animate-in slide-in-from-bottom-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4 text-pink-500" /> Walled Garden Config
            </h4>
            <button
              onClick={() => setShowHelper(false)}
              className="text-gray-400 font-bold text-[9px] uppercase"
            >
              Dismiss
            </button>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex gap-2 items-center">
            <code className="text-[9px] font-mono text-gray-500 truncate flex-1 leading-none">
              {WALLED_GARDEN}
            </code>
            <button
              onClick={() => copyToClipboard(WALLED_GARDEN)}
              className="p-2 bg-pink-500 text-white rounded-lg shadow-sm hover:bg-pink-600 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
        Onetel Network • Gateway Core v3.3
      </p>
    </div>
  );
};

export default App;
