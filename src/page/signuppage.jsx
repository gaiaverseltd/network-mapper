import { motion } from "framer-motion";
import { signupwithemail } from "../service/Auth/index";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Login from "../layout/login/login";
import { toast } from "react-toastify";

const Signuppage = () => {
  const navigate = useNavigate();

  const handelsubmit = async (email, pass) => {
    const sigup = await signupwithemail(email, pass);
    sigup && toast.success("signup successfully ");
    sigup && navigate("/create-account");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6">
      <Helmet>
        <title>Sign up | NetMap</title>
        <meta name="description" content="Sign up for Accel Net" />
        <link rel="canonical" href="/" />
        <meta name="robots" content="index, follow" />
       
        <meta name="keywords" content="sign up, accel net, register" />
        <meta name="author" content="Accel Net" />
        <meta name="language" content="EN" />
      </Helmet>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 lg:gap-12">
        <div className="w-full lg:w-1/2 flex justify-end items-center">
          <img src="/logo.png" alt="logo" className="max-w-full h-auto object-contain" />
        </div>
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col items-center justify-center">
          <Login onenter={handelsubmit} role="signup" />
        </div>
      </div>
    </div>
  );
};

export default Signuppage;
