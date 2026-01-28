import React, { useState, useEffect } from "react";
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
  const [showHelper, setShowHelper] = useState(true);

  // Router Redirect Params
  const [uamParams, setUamParams] = useState({
    uamip: "192.168.182.1",
    uamport: "3990",
    challenge: "",
  });
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Some routers wrap everything in a "loginurl" param, try to parse that too
    const loginUrl = params.get("loginurl");
    let targetParams = params;

    if (loginUrl) {
      try {
        const decodedUrl = new URL(decodeURIComponent(loginUrl));
        targetParams = decodedUrl.searchParams;
      } catch (e) {
        // Fallback to top level params
      }
    }

    const uamip =
      targetParams.get("uamip") || params.get("uamip") || "192.168.182.1";
    const uamport =
      targetParams.get("uamport") || params.get("uamport") || "3990";
    const challenge =
      targetParams.get("challenge") || params.get("challenge") || "";

    setUamParams({ uamip, uamport, challenge });
    setCurrentUrl(window.location.origin + window.location.pathname);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "username") {
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await registerUser(formData);
      const data = await parseResponse(response);
      if (response.ok) {
        const token = data.token || data.key || data.token_key;
        if (token) {
          setAuthToken(token);
          await requestOtp(token);
          setStep("OTP_VERIFY");
        }
      } else {
        setErrorMessage(data.detail || "Registration failed.");
      }
    } catch (err) {
      setErrorMessage("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
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
        setErrorMessage(data.detail || "Invalid login details.");
      }
    } catch (err) {
      setErrorMessage("Login failed. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await verifyOtp(authToken, otpCode);
      if (response.ok) setStep("SUCCESS");
      else setErrorMessage("Invalid verification code.");
    } catch (err) {
      setErrorMessage("Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const connectToRouter = () => {
    // CoovaChilli login redirection
    const loginUrl = `http://${uamParams.uamip}:${uamParams.uamport}/logon`;
    const form = document.createElement("form");
    form.method = "GET"; // Chilli usually expects GET for simple UAM
    form.action = loginUrl;

    const params = {
      username: step === "SUCCESS" ? formData.username : loginData.username,
      password: step === "SUCCESS" ? formData.password1 : loginData.password,
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
    alert("Value copied to clipboard!");
  };

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
            Ready to Go!
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
            Click below to connect your device to the high-speed Onetel network.
          </p>
          <button
            onClick={connectToRouter}
            className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            Connect to Internet <Zap className="w-5 h-5" />
          </button>
        </div>
      );
    }

    if (step === "USAGE_INFO" && !usageData?.hasData) {
      return (
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-orange-500 animate-in zoom-in">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-orange-500">
              <Database className="w-10 h-10" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">No Data</h2>
          <p className="text-gray-600 mb-8">
            Your data balance has been depleted. Top up now to continue
            browsing.
          </p>
          <button className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 mb-4">
            Top Up Now <ShoppingCart className="w-5 h-5" />
          </button>
          <button
            onClick={() => setStep("LOGIN")}
            className="text-gray-400 text-sm font-bold hover:underline"
          >
            Back to Login
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100">
        <div className="hidden lg:flex flex-col justify-between p-12 bg-pink-500 text-white relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400 opacity-20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold leading-tight mb-6 text-white">
              Experience High Speed WiFi
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" /> Unlimited Social Media
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" /> Low Latency Gaming
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" /> 4K Video Streaming
              </div>
            </div>
          </div>
          <p className="relative z-10 text-pink-100 text-sm italic">
            "Connect once, browse forever."
          </p>
        </div>

        <div className="p-8 sm:p-12 flex flex-col justify-center">
          {step === "LOGIN" && (
            <div className="animate-in slide-in-from-right duration-300">
              <h3 className="text-2xl font-bold mb-8 text-gray-900">
                Welcome Back
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
                  <div className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                    {errorMessage}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Login & Connect <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              <button
                onClick={() => setStep("REGISTRATION")}
                className="w-full mt-6 text-pink-500 font-bold text-sm hover:underline"
              >
                New user? Create an account
              </button>
            </div>
          )}

          {step === "REGISTRATION" && (
            <div className="animate-in slide-in-from-right duration-300">
              <h3 className="text-2xl font-bold mb-6 text-gray-900">
                Create Account
              </h3>
              <form onSubmit={handleRegisterSubmit} className="space-y-1">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    name="first_name"
                    placeholder="First"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    icon={<User className="w-4 h-4" />}
                  />
                  <Input
                    label="Last Name"
                    name="last_name"
                    placeholder="Last"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    icon={<User className="w-4 h-4" />}
                  />
                </div>
                <Input
                  label="Mobile"
                  name="username"
                  type="tel"
                  placeholder="+27..."
                  value={formData.username}
                  onChange={handleInputChange}
                  icon={<Phone className="w-4 h-4" />}
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="user@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  icon={<Mail className="w-4 h-4" />}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Pass"
                    name="password1"
                    type="password"
                    value={formData.password1}
                    onChange={handleInputChange}
                    icon={<Lock className="w-4 h-4" />}
                  />
                  <Input
                    label="Confirm"
                    name="password2"
                    type="password"
                    value={formData.password2}
                    onChange={handleInputChange}
                    icon={<Lock className="w-4 h-4" />}
                  />
                </div>
                {errorMessage && (
                  <div className="text-red-500 text-xs font-bold p-2">
                    {errorMessage}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Sign Up Now <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              <button
                onClick={() => setStep("LOGIN")}
                className="w-full mt-4 text-pink-500 font-bold text-sm hover:underline"
              >
                Already have an account? Login
              </button>
            </div>
          )}

          {step === "OTP_VERIFY" && (
            <div className="animate-in slide-in-from-right duration-300">
              <h3 className="text-2xl font-bold mb-2 text-gray-900">
                Verify Phone
              </h3>
              <p className="text-gray-500 mb-8 text-sm">
                Enter the code sent to {formData.username}
              </p>
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <Input
                  label="Code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  className="text-center text-3xl tracking-widest"
                  maxLength={6}
                  icon={<MessageSquare className="w-4 h-4" />}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Confirm & Access"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  const WALLED_GARDEN =
    "tmanscript.github.io,github.io,esm.sh,cdn.tailwindcss.com,fonts.googleapis.com,fonts.gstatic.com,corsproxy.io,device.onetel.co.za";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#fdf2f8]">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-pink-500 rounded-2xl shadow-lg mb-4">
          <Wifi className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          ONETEL<span className="text-pink-500">.</span>
        </h1>
      </div>

      {renderContent()}

      <div className="mt-12 max-w-xl w-full">
        {showHelper && (
          <div className="bg-white border-2 border-pink-100 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-pink-500 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-4 h-4" /> OpenWISP Configuration Settings
              </h4>
              <button
                onClick={() => setShowHelper(false)}
                className="text-gray-300 hover:text-gray-500 text-[10px] font-bold uppercase"
              >
                Hide
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                  uamhomepage / uamserver / chilli_login_page
                </p>
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <code className="text-[10px] font-mono text-gray-600 truncate flex-1">
                    {currentUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(currentUrl)}
                    className="p-1.5 bg-white text-pink-500 rounded-lg shadow-sm border border-pink-100"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                  uamallowed (The Walled Garden)
                </p>
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <code className="text-[10px] font-mono text-gray-600 truncate flex-1 leading-tight">
                    {WALLED_GARDEN}
                  </code>
                  <button
                    onClick={() => copyToClipboard(WALLED_GARDEN)}
                    className="p-1.5 bg-white text-pink-500 rounded-lg shadow-sm border border-pink-100"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-pink-50 rounded-xl">
              <p className="text-[9px] text-pink-600 font-medium leading-normal italic">
                * Paste these values into your OpenWISP Hotspot settings.
                Without the "uamallowed" domains, your portal will not load
                properly for users.
              </p>
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest">
          Onetel Network • Captive Gateway v2.6
        </p>
      </div>
    </div>
  );
};

export default App;
