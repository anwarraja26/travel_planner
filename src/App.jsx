import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
// import { Button } from './components/ui/button.jsx'
import './App.css'
import  Hero  from './components/custom/Hero.jsx'
function App() {
  return (
    <>
      <Hero />
    </>
  )
}

export default App;


// import { useEffect } from 'react';
// import Login from './login.jsx';
// import Logout from './logout.jsx';

// const clientId = "225170725898-fp9n6ff5mmrk5le3qvlb2t7ct2vh3lmn.apps.googleusercontent.com";

// function App() {
//   useEffect(() => {
//     function start() {
//       gapi.client.init({
//         clientId: clientId,
//         scope: "",
//       });
//     }
//     gapi.load('client:auth2', start);
//   }, []);

//   return (
//     <div>
//       <h1>Google Login</h1>
//       <Login />
//       <Logout />
//     </div>
//   );
// }

// export default App;
