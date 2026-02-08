import { useState } from "react";
import { getWeather } from "./weatherService";
const Weather = () => {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCityChange = (e) => {
    setCity(e.target.value);
  };

  const handleGetWeather = async () => {
    if (!city) {
      return setError("Please enter a city name.");
    }

    setLoading(true);
    setError("");
    
    try {
      const weatherData = await getWeather(city);
      setWeather(weatherData);
      setError(""); 
    } catch (err) {
      setWeather(null);
      setError("Failed to fetch weather. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="weather-container">
      <h2>Weather Prediction</h2>

      <input
        type="text"
        placeholder="Enter city name"
        value={city}
        onChange={handleCityChange}
      />
      <button onClick={handleGetWeather} disabled={loading}>
        {loading ? "Fetching..." : "Get Weather"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {weather && (
        <div>
          <h3>{weather.city}</h3>
          <p>Temperature: {weather.temperature}°C</p>
          <p>Description: {weather.description}</p>
        </div>
      )}
    </div>
  );
};

export default Weather;