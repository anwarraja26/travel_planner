function Logout() {
    const handleLogout = () => {
      console.log("User logged out");
      // Clear localStorage/sessionStorage or update your state
    };
  
    return (
      <div>
        <h1>Logout</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }
  
  export default Logout;
  