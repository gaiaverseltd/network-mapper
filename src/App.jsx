import './App.css';
import 'react-toastify/dist/ReactToastify.css';
import { Routes, Route } from 'react-router-dom';
import { Home } from './page/home';
import signuppage from './page/signuppage';
import { Loginpage } from './page/loginpage';
import CreateAccount from './page/create-account';
import { useState } from 'react';
import { UserDataProvider } from './service/context/usercontext';
import { config } from './config/config';
import { ToastContainer } from 'react-toastify';
import { Profilepage } from './page/profilepage';
import Notification from './page/notification';
import Messages from './page/messages';
import Seepost from './page/seepost';
import Search from './page/search';
import Notfound from './page/not-found';
import { Layout } from './layout/layout';
import { List } from './page/list';
import { AdminUsers } from './page/admin-users';
import { AdminTags } from './page/admin-tags';
import { AdminCustomFields } from './page/admin-custom-fields';
import EditProfile from './page/edit-profile';
import MapPage from './page/map';

function App() {
   const [userdata, setuserdata] = useState(null);
   return (
      <UserDataProvider
         value={userdata}
         setvalue={setuserdata}>
         <div className='min-h-screen w-full bg-bg-default'>
            <div className='w-full'>
               <ToastContainer
                  position='top-center'
                  autoClose={3000}
                  hideProgressBar={false}
                  newestOnTop={true}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme='dark'
                  toastClassName='bg-bg-tertiary border border-border-default rounded-xl'
                  progressClassName='bg-accent-500'
                  bodyClassName='text-text-primary font-medium'
               />

               <Routes>
                  <Route
                     exact
                     path='/'
                     Component={config.features.hideSignupPage ? Loginpage : signuppage}
                  />
                  <Route
                     exact
                     path='/login'
                     Component={Loginpage}
                  />
                  <Route
                     path='/home'
                     element={<Layout Component={Home} />}
                  />
                  <Route
                     path='/dashboard'
                     element={<Layout Component={Home} />}
                  />
                  <Route
                     exact
                     path='/create-account'
                     Component={CreateAccount}
                  />
                  <Route
                     exact
                     path='/search'
                     element={<Layout Component={Search} />}
                  />
                  <Route
                     exact
                     path='/map'
                     element={<Layout Component={MapPage} />}
                  />
                  <Route
                     exact
                     path='/profile/:username'
                     element={<Layout Component={Profilepage} />}
                  />
                  <Route
                     exact
                     path='/profile/:username/:postid'
                     element={<Layout Component={Seepost} />}
                  />
                  {userdata && (
                     <Route
                        exact
                        path='/setting/edit-profile'
                        element={<Layout Component={EditProfile} />}
                     />
                  )}
                  {userdata && (
                     <Route
                        exact
                        path='/notification'
                        element={<Layout Component={Notification} />}
                     />
                  )}
                  {userdata && (
                     <>
                        <Route path='/messages' element={<Layout Component={Messages} />} />
                        <Route path='/messages/:username' element={<Layout Component={Messages} />} />
                     </>
                  )}
                  {userdata && (
                     <Route
                        exact
                        path='/bookmarks'
                        element={<Layout Component={List} />}
                     />
                  )}
                  {userdata?.isAdmin && (
                     <Route
                        exact
                        path='/admin/users'
                        element={<Layout Component={AdminUsers} />}
                     />
                  )}
                  {userdata?.isAdmin && (
                     <Route
                        exact
                        path='/admin/users/:uid'
                        element={<Layout Component={AdminUsers} />}
                     />
                  )}
                  {userdata?.isAdmin && (
                     <Route
                        exact
                        path='/admin/tags'
                        element={<Layout Component={AdminTags} />}
                     />
                  )}
                  {userdata?.isAdmin && (
                     <Route
                        exact
                        path='/admin/custom-fields'
                        element={<Layout Component={AdminCustomFields} />}
                     />
                  )}
                  <Route
                     path='*'
                     Component={Notfound}
                  />
               </Routes>
            </div>
         </div>
      </UserDataProvider>
   );
}

export default App;
