import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { forget_password } from "../../service/Auth";
import { useUserdatacontext } from "../../service/context/usercontext";
import { config } from "../../config/config";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Input } from "../../ui/input";
import Button from "../../ui/button";
import PropTypes from "prop-types";

const Login = ({ onenter, role }) => {
  const [email, setemail] = useState("");
  const [pass, setpass] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { userdata } = useUserdatacontext();
  const navigate = useNavigate();

  const handelsubmit = async () => {
    setIsLoading(true);
    try {
      await onenter(email, pass);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to dashboard when user has full profile (after login)
  useEffect(() => {
    if (userdata) {
      navigate("/dashboard");
    }
  }, [userdata, navigate]);

  const isLogin = role === "login";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col w-full max-w-md mx-auto px-4 py-8 sm:py-12"
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-text-primary mb-2">
          {isLogin ? "Welcome back" : "Join NetMap"}
        </h1>
        <p className="text-text-secondary text-[15px]">
          {isLogin
            ? "Sign in to continue to your account"
            : "Create your account to get started"}
        </p>
      </div>

      {/* Email Form */}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handelsubmit();
        }}
      >
        <Input
          type="email"
          name="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setemail(e.target.value)}
          required
          label="Email"
        />

        <Input
          type="password"
          name="password"
          placeholder="Password"
          value={pass}
          onChange={(e) => setpass(e.target.value)}
          required
          label="Password"
        />

        {role === "login" && (
          <button
            onClick={async () => {
              if (email === "") {
                toast.error("Please enter your email address");
              } else {
                const data = await forget_password(email);
                if (!data) {
                  toast.error("Email not found");
                } else {
                  toast.success("Email sent! Please check your inbox.");
                }
              }
            }}
            type="button"
            className="text-sm text-accent-500 hover:text-accent-400 transition-colors text-left mt-2"
          >
            Forgot password?
          </button>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          variant="primary"
          className="w-full mt-2"
          size="lg"
        >
          {isLoading ? "Loading..." : role === "login" ? "Sign In" : "Sign Up"}
        </Button>
      </form>

      {/* Terms */}
      {!isLogin && (
        <p className="text-xs text-text-tertiary text-center mt-4 px-4">
          By signing up, you agree to the{" "}
          <span className="text-accent-500 hover:underline">Terms of Service</span>{" "}
          and{" "}
          <span className="text-accent-500 hover:underline">Privacy Policy</span>,
          including Cookie Use.
        </p>
      )}

      {/* Sign In/Sign Up Link – hide "Sign up" when signup page is disabled */}
      {!(isLogin && config.features.hideSignupPage) && (
        <div className="mt-8 text-center">
          <p className="text-text-secondary text-[15px] mb-3">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </p>
          <Link
            to={isLogin ? "/" : "/login"}
            className="text-accent-500 hover:text-accent-400 font-semibold text-[15px] transition-colors"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </Link>
        </div>
      )}
    </motion.section>
  );
};

Login.propTypes = {
  role: PropTypes.string,
  onenter: PropTypes.func,
};
export default Login;
