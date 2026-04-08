import React, { Fragment, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUserdatacontext } from "../../service/context/usercontext";
import Button from "../../ui/button";
import Avatar from "../../ui/avatar";
import { MdPerson as PersonIcon } from "react-icons/md";
import { AiFillHome as CottageIcon } from "react-icons/ai";
import { BsSearch as SearchIcon } from "react-icons/bs";
import { MdNotifications as NotificationsIcon } from "react-icons/md";
import { MdMailOutline as MessagesIcon } from "react-icons/md";
import { MdAdd as AddIcon } from "react-icons/md";
import { MdSettings as SettingsIcon } from "react-icons/md";
import { MdPeople as PeopleIcon } from "react-icons/md";
import { MdLabel as LabelIcon } from "react-icons/md";
import { MdEditAttributes as CustomFieldsIcon } from "react-icons/md";
import { MdAdminPanelSettings as AdminIcon } from "react-icons/md";
import { Popupitem } from "../../ui/popup";
import { auth } from "../../service/Auth";
import Resetpassword from "../setting/resetpassword";
import Block from "../setting/block";
import Report from "../setting/Report";
import DeveloperContact from "../setting/Develope";

function Mobilenavbar({ navbar, setpost }) {
  const { userdata, defaultprofileimage, isAdmin } = useUserdatacontext();
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const isActive = (path) => {
    if (path === "/home") return location.pathname === "/home";
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { id: "home", icon: CottageIcon, path: "/home" },
    { id: "search", icon: SearchIcon, path: "/search" },
    ...(isAdmin ? [{ id: "admin", icon: AdminIcon, path: null, isDropdown: true }] : []),
    { id: "messages", icon: MessagesIcon, path: userdata?.username ? "/messages" : "/login" },
    { id: "notifications", icon: NotificationsIcon, path: userdata?.username ? "/notification" : "/login" },
    { id: "profile", icon: PersonIcon, path: userdata?.username ? `/profile/${userdata.username}` : "/login" },
  ];

  const adminNavItems = [
    { id: "admin-users", icon: PeopleIcon, label: "Users", path: "/admin/users" },
    { id: "admin-tags", icon: LabelIcon, label: "Tags", path: "/admin/tags" },
    { id: "admin-custom-fields", icon: CustomFieldsIcon, label: "Custom fields", path: "/admin/custom-fields" },
  ];

  return (
    <Fragment>
      {/* Mobile Top Navbar */}
      <AnimatePresence>
        {navbar && (
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed top-0 left-0 right-0 z-50 bg-bg-default/80 backdrop-blur-xl border-b border-border-default"
          >
            <header className="flex items-center justify-between px-4 py-3">
              <Link
                to={userdata?.username ? `/profile/${userdata.username}` : "/login"}
                className="flex-shrink-0"
              >
                <Avatar
                  src={userdata?.profileImageURL}
                  alt={userdata?.name || "Profile"}
                  size="md"
                  fallback={defaultprofileimage}
                  onClick={() => {}}
                />
              </Link>

              <Link to="/home">
                <motion.h1
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-2xl font-bold text-gradient cursor-pointer"
                >
                  NetMap
                </motion.h1>
              </Link>

              <button
                type="button"
                onClick={() => userdata?.username && setSettingsOpen(true)}
                className="flex-shrink-0 p-2 rounded-full hover:bg-bg-hover transition-all duration-200"
              >
                <motion.div
                  whileHover={{ scale: 1.1, backgroundColor: "rgba(22, 24, 28, 0.5)" }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full"
                >
                  <SettingsIcon className="text-text-secondary hover:text-text-primary transition-colors duration-200" />
                </motion.div>
              </button>
            </header>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navbar */}
      <AnimatePresence>
        {navbar && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-default/80 backdrop-blur-xl border-t border-border-default"
          >
            <div className="flex items-center justify-around py-2 px-4">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const active = item.path ? isActive(item.path) : adminNavItems.some((a) => isActive(a.path));
                if (item.isDropdown) {
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <button
                        type="button"
                        onClick={() => setAdminMenuOpen(true)}
                        className="p-3 rounded-full transition-all duration-200 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={active ? "text-accent-500" : ""}
                        >
                          <Icon className="text-2xl" />
                        </motion.div>
                      </button>
                    </motion.div>
                  );
                }
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={item.path}>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={`p-3 rounded-full transition-all duration-200 ${
                          active
                            ? "bg-bg-tertiary text-accent-500 font-semibold"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        }`}
                      >
                        <Icon className={`text-2xl ${active ? "text-accent-500" : ""}`} />
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}

              {/* Create Post Button */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              >
                <Button
                  onClick={() => setpost(true)}
                  className="rounded-full p-3 shadow-medium hover:shadow-glow"
                  size="sm"
                >
                  <AddIcon />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Admin menu modal */}
      {adminMenuOpen && (
        <Popupitem closefunction={() => setAdminMenuOpen(false)}>
          <div className="my-5">
            <h2 className="text-xl font-bold text-text-primary mb-3">Admin</h2>
            <div className="flex flex-col gap-1">
              {adminNavItems.map((sub) => {
                const SubIcon = sub.icon;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      navigate(sub.path);
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                  >
                    <SubIcon className="text-xl text-text-secondary" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Popupitem>
      )}

      {/* Mobile Settings menu modal */}
      {settingsOpen && (
        <Popupitem
          closefunction={() => {
            setSettingsOpen(false);
            setSettingsPanel(null);
          }}
        >
          <div className="my-5 max-h-[85vh] overflow-y-auto">
            {!settingsPanel ? (
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-text-primary mb-3">Settings</h2>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate(`/profile/${userdata?.username}`);
                  }}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate("/setting/edit-profile");
                  }}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate("/bookmarks");
                  }}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Bookmarks
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsPanel("password")}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Password and Protection
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsPanel("block")}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Who Can See Your Posts
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsPanel("report")}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Report a Problem
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsPanel("developer")}
                  className="px-4 py-3 text-left rounded-xl hover:bg-bg-hover text-text-primary"
                >
                  Developer Contact
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setSettingsOpen(false);
                    await auth.signOut();
                    navigate("/");
                  }}
                  className="px-4 py-3 text-left rounded-xl hover:bg-status-error/20 text-status-error mt-2"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSettingsPanel(null)}
                  className="mb-3 text-sm text-text-secondary hover:text-text-primary"
                >
                  ← Back
                </button>
                {settingsPanel === "password" && (
                  <Resetpassword toggle={() => { setSettingsOpen(false); setSettingsPanel(null); }} />
                )}
                {settingsPanel === "block" && <Block />}
                {settingsPanel === "report" && <Report />}
                {settingsPanel === "developer" && <DeveloperContact />}
                {settingsPanel !== "password" && (
                  <button
                    type="button"
                    onClick={() => { setSettingsOpen(false); setSettingsPanel(null); }}
                    className="mt-4 px-4 py-2 rounded-lg border border-border-default hover:bg-bg-hover"
                  >
                    Close
                  </button>
                )}
              </>
            )}
          </div>
        </Popupitem>
      )}
    </Fragment>
  );
}

export default Mobilenavbar;
