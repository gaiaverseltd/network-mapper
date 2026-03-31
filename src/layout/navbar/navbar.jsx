import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AiFillHome as HomeIcon } from "react-icons/ai";
import { BsSearch as SearchIcon } from "react-icons/bs";
import { MdNotifications as NotificationsIcon } from "react-icons/md";
import { MdMailOutline as MessagesIcon } from "react-icons/md";
import { MdPerson as PersonIcon } from "react-icons/md";
import { MdBookmarks as BookmarksIcon } from "react-icons/md";
import { Link } from "react-router-dom";
import { useUserdatacontext } from "../../service/context/usercontext";
import { auth } from "../../service/Auth";
import { useNavigate } from "react-router-dom";
import { Popupitem } from "../../ui/popup";
import { Createpost } from "../../component/createpost";
import Mobilenavbar from "./mobile-navbar";
import Button from "../../ui/button";
import Avatar from "../../ui/avatar";
import Badge from "../../ui/badge";
import { MdPeople as PeopleIcon } from "react-icons/md";
import { MdLabel as LabelIcon } from "react-icons/md";
import { MdEditAttributes as CustomFieldsIcon } from "react-icons/md";
import { MdExpandMore as ExpandMoreIcon } from "react-icons/md";
import { MdAdminPanelSettings as AdminIcon } from "react-icons/md";
import Logo from "../../ui/logo";
import Resetpassword from "../setting/resetpassword";
import Block from "../setting/block";
import Report from "../setting/Report";
import DeveloperContact from "../setting/Develope";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userdata, userNotifications, unreadMessageCount, defaultprofileimage, isAdmin } = useUserdatacontext();
  const [post, setpost] = useState(false);
  const [navbar, setnavbar] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [settingsModalContent, setSettingsModalContent] = useState(null);
  const userMenuRef = useRef(null);
  const adminMenuRef = useRef(null);

  const [prevScrollPos, setPrevScrollPos] = useState(window.scrollY);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setAdminMenuOpen(false);
      }
    };
    if (adminMenuOpen) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [adminMenuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      setnavbar(prevScrollPos > currentScrollPos || currentScrollPos < 10);
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [prevScrollPos]);

  const navItemsDesktop = useMemo(() => {
    return [
      { icon: HomeIcon, label: "Home", path: "/home", id: "home" },
      { icon: SearchIcon, label: "Explore", path: userdata?.username ? "/search" : "/login", id: "explore" },
      { icon: MessagesIcon, label: "Messages", path: userdata?.username ? "/messages" : "/login", id: "messages", badge: unreadMessageCount > 0 ? unreadMessageCount : null },
      { icon: NotificationsIcon, label: "Notifications", path: userdata?.username ? "/notification" : "/login", id: "notifications", badge: userNotifications?.length > userdata?.notification ? userNotifications.length - userdata.notification : null },
      { icon: BookmarksIcon, label: "Bookmarks", path: userdata?.username ? "/bookmarks" : "/login", id: "bookmarks" },
      { icon: PersonIcon, label: "Profile", path: userdata?.username ? `/profile/${userdata.username}` : "/login", id: "profile" },
    ];
  }, [userdata?.username, userNotifications, userdata?.notification, unreadMessageCount]);

  const adminNavItems = useMemo(() => [
    { icon: PeopleIcon, label: "Users", path: "/admin/users", id: "admin-users" },
    { icon: LabelIcon, label: "Tags", path: "/admin/tags", id: "admin-tags" },
    { icon: CustomFieldsIcon, label: "Custom fields", path: "/admin/custom-fields", id: "admin-custom-fields" },
  ], []);

  const isActive = (path) => {
    if (path === "/home") return location.pathname === "/home";
    return location.pathname.startsWith(path);
  };
  return (
    <Fragment>
      {/* Desktop Navbar - Sticky */}
      <header className="sticky top-0 hidden md:flex h-screen w-full flex-col z-40">
        <nav className="flex flex-col h-full px-3">
          {/* Logo */}
          <div className="px-3 py-3 mb-4">
            <Link to="/home">
              <div className="w-full flex hover:bg-bg-hover transition-colors duration-200 cursor-pointer">
              <Logo size="md" showText={true} className="rounded-full hover:bg-bg-hover" />
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 flex flex-col">
            {navItemsDesktop.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.id} to={item.path}>
                  <div
                    className={`relative flex items-center gap-4 px-4 py-3 mb-1 rounded-full transition-colors duration-200 hover:bg-bg-hover ${
                      active ? "font-bold" : "font-normal"
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`text-2xl ${active ? "text-text-primary" : "text-text-secondary"}`} />
                      {item.badge && (
                        <Badge count={item.badge} variant="default" size="sm" />
                      )}
                    </div>
                    <span className={`text-xl ${active ? "text-text-primary" : "text-text-secondary"}`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}

            {/* Post Button */}
            <Button
              onClick={() => setpost(true)}
              className="w-[90%] mx-auto mb-5 mt-auto"
            >
              Post
            </Button>
          </nav>

          {/* Admin (between Post and User) */}
          {isAdmin && (
            <div className="relative mb-2" ref={adminMenuRef}>
              <button
                type="button"
                onClick={() => setAdminMenuOpen((o) => !o)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors duration-200 hover:bg-bg-hover text-left ${
                  adminMenuOpen || adminNavItems.some((a) => isActive(a.path)) ? "font-bold" : "font-normal"
                }`}
              >
                <AdminIcon className={`text-2xl ${adminMenuOpen || adminNavItems.some((a) => isActive(a.path)) ? "text-text-primary" : "text-text-secondary"}`} />
                <span className={`text-xl ${adminMenuOpen || adminNavItems.some((a) => isActive(a.path)) ? "text-text-primary" : "text-text-secondary"}`}>
                  Admin
                </span>
                <ExpandMoreIcon
                  className={`ml-auto text-xl text-text-secondary transition-transform ${adminMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {adminMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 py-1 rounded-xl bg-bg-secondary border border-border-default shadow-lg overflow-hidden z-50 flex flex-col">
                  {adminNavItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const subActive = isActive(sub.path);
                    return (
                      <Link
                        key={sub.id}
                        to={sub.path}
                        onClick={() => setAdminMenuOpen(false)}
                        className={`flex items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-bg-hover ${subActive ? "font-bold text-text-primary" : "text-text-secondary"}`}
                      >
                        <SubIcon className="text-xl" />
                        <span className="text-[15px]">{sub.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* User Profile + Dropdown */}
          <div className="mt-auto mb-4 relative" ref={userMenuRef}>
            {auth.currentUser && userdata ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setUserMenuOpen((open) => !open);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-full cursor-pointer transition-colors duration-200 hover:bg-bg-hover text-left"
                >
                  <Avatar
                    src={userdata.profileImageURL}
                    alt={userdata.name || "Profile"}
                    size="md"
                    fallback={defaultprofileimage}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] text-text-primary truncate">{userdata.name}</p>
                    <p className="text-[15px] text-text-secondary truncate">@{userdata.username}</p>
                  </div>
                  <ExpandMoreIcon
                    className={`flex-shrink-0 text-xl text-text-secondary transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {userMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 py-1 rounded-xl bg-bg-secondary border border-border-default shadow-lg overflow-hidden z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate(`/profile/${userdata.username}`);
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/setting/edit-profile");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/bookmarks");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Bookmark Collection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsModalContent("password");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Password and Protection
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsModalContent("block");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Who Can See Your Posts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsModalContent("report");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Report a Problem
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsModalContent("developer");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-text-primary hover:bg-bg-hover"
                    >
                      Developer Contact
                    </button>
                    <div className="border-t border-border-default my-1" />
                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await auth.signOut();
                        navigate("/");
                      }}
                      className="w-full px-4 py-2.5 text-left text-[15px] text-status-error hover:bg-status-error/10"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-transparent border border-border-default text-text-primary font-bold py-3 rounded-full hover:bg-bg-hover transition-colors duration-200"
              >
                Sign In
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Create Post Modal */}
      {post && (
        <Popupitem
          closefunction={() => {
            setpost(false);
          }}
        >
          <div className="my-5">
            <Createpost
              toggle={() => {
                setpost(false);
              }}
            />
          </div>
        </Popupitem>
      )}

      {/* Settings panels modal (Password, Block, Report, Developer) */}
      {settingsModalContent && (
        <Popupitem closefunction={() => setSettingsModalContent(null)}>
          <div className="my-5 max-h-[85vh] overflow-y-auto">
            {settingsModalContent === "password" && (
              <Resetpassword toggle={() => setSettingsModalContent(null)} />
            )}
            {settingsModalContent === "block" && (
              <>
                <Block />
                <button
                  type="button"
                  onClick={() => setSettingsModalContent(null)}
                  className="mt-4 px-4 py-2 rounded-lg border border-border-default hover:bg-bg-hover"
                >
                  Close
                </button>
              </>
            )}
            {settingsModalContent === "report" && (
              <>
                <Report />
                <button
                  type="button"
                  onClick={() => setSettingsModalContent(null)}
                  className="mt-4 px-4 py-2 rounded-lg border border-border-default hover:bg-bg-hover"
                >
                  Close
                </button>
              </>
            )}
            {settingsModalContent === "developer" && (
              <>
                <DeveloperContact />
                <button
                  type="button"
                  onClick={() => setSettingsModalContent(null)}
                  className="mt-4 px-4 py-2 rounded-lg border border-border-default hover:bg-bg-hover"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </Popupitem>
      )}

      {/* Mobile Navbar */}
    <div className="md:hidden">
      <Mobilenavbar setpost={setpost} navbar={navbar} />
    </div>
    </Fragment>
  );
};

export default Navbar;
