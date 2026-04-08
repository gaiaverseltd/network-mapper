import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useUserdatacontext } from "../service/context/usercontext";
import { MdArrowBack as ArrowBackIcon } from "react-icons/md";
import Editfuserdata from "../layout/profile/editfuserdata";

export default function EditProfile() {
  const navigate = useNavigate();
  const { userdata } = useUserdatacontext();

  if (!userdata) return null;

  return (
    <>
      <Helmet>
        <title>Edit profile | NetMap</title>
      </Helmet>

      <div className="w-full flex flex-col min-h-screen">
        <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default">
          <div className="flex items-center gap-4 h-[53px] px-4">
            <button
              type="button"
              onClick={() => navigate(userdata?.username ? `/profile/${userdata.username}` : "/home")}
              className="p-2 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Back to profile"
            >
              <ArrowBackIcon className="text-xl" />
            </button>
            <h1 className="text-xl font-bold text-text-primary">Edit profile</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Editfuserdata toggle={() => navigate(userdata?.username ? `/profile/${userdata.username}` : "/home")} />
        </div>
      </div>
    </>
  );
}
