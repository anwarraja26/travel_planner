import { GoogleLogin } from '@react-oauth/google';
import jwt_decode from 'jwt-decode';

function Login() {
  return (
    <div>
      <h1>Login</h1>
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          const decoded = jwt_decode(credentialResponse.credential);
          console.log("Decoded JWT:", decoded);
        }}
        onError={() => {
          console.log("Login Failed");
        }}
      />
    </div>
  );
}

export default Login;
