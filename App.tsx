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

  // Diagnostic State - Added corsproxy.io as it is now required for the API
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

        // We just need to see if the server responds at all (even with a 404)
        // A response means the router allowed the packet through.
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
          const hasData = remainingBytes > 0;
          setUsageData({ remainingMB, hasData });
          setStep("USAGE_INFO");
        } else {
          setStep("SUCCESS");
        }
      } else {
        setErrorMessage(data.detail || "Incorrect phone number or password.");
      }
    } catch (err) {
      console.error("API Error:", err);
      setIsNetworkError(true);
      setErrorMessage(
        'Network error. Ensure "corsproxy.io" is allowed in router settings.',
      );
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

    const params = {
      username: loginData.username,
      password: loginData.password,
    };

    Object.entries(params).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

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
          <p className="text-gray-600 mb-8">
            Click below to activate your high-speed internet session.
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

    return (
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100">
        <div className="hidden lg:flex flex-col justify-between p-12 bg-pink-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400 opacity-20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold leading-tight mb-6">
              High Speed WiFi
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />{" "}
                <span>Secured Authentication</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />{" "}
                <span>Usage Monitoring</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 bg-black/10 backdrop-blur-md rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-pink-100">
              Hotspot Health
            </p>
            <div className="grid grid-cols-2 gap-2">
              {diagnostics.map((d) => (
                <div
                  key={d.domain}
                  className="flex items-center gap-2 text-[9px] font-bold"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${d.status === "ok" ? "bg-green-400" : d.status === "blocked" ? "bg-red-400 animate-pulse" : "bg-yellow-400"}`}
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

            {isNetworkError && (
              <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl animate-in shake">
                <ShieldAlert className="w-6 h-6 text-red-500 mb-2" />
                <p className="text-red-700 font-bold text-[11px] uppercase mb-1">
                  CORS Block / Network Error
                </p>
                <p className="text-red-600 text-[10px] mb-3">
                  Ensure <b>corsproxy.io</b> is added to your router's Walled
                  Garden list.
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(WALLED_GARDEN)}
                  className="w-full py-2 bg-red-100 text-red-700 font-bold text-[10px] rounded-lg border border-red-200 flex items-center justify-center gap-2"
                >
                  <Copy className="w-3 h-3" /> Copy Fix List
                </button>
              </div>
            )}

            {errorMessage && !isNetworkError && (
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
            <h4 className="text-[10px] font-black text-gray-800 uppercase tracking-widest">
              Walled Garden Config
            </h4>
            <button
              onClick={() => setShowHelper(false)}
              className="text-gray-400 font-bold text-[9px] uppercase"
            >
              Dismiss
            </button>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex gap-2 items-center">
            <code className="text-[9px] font-mono text-gray-500 truncate flex-1">
              {WALLED_GARDEN}
            </code>
            <button
              onClick={() => copyToClipboard(WALLED_GARDEN)}
              className="p-2 bg-pink-500 text-white rounded-lg shadow-sm"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest">
        Onetel Network • Gateway v3.1
      </p>
    </div>
  );
};

export default App;
