import React from 'react'
import {Link} from 'react-router-dom'
export default function Hero() {
  return (
    <div className="flex flex-col items-center mx-56 gap-9">
      <h1 className="font-extrabold text-[40px] text-center mt-15">
      <span className="text-[#f56551]">Discover your Next Adventure with AI:</span><br/>Personalized Itineraries at Your Fingertips</h1>
      <p className="text-xl text-gray-500 text-center">Your personal trip planner and travel curator, creating custom itineraries tailored to your interests and budget</p>
      <Link to="./create-trip">
      <button className="bg-black text-white px-6 py-3 rounded-2xl shadow-md hover:bg-gray-800 transition duration-300 ease-in-out">Get Started, It's Free</button>
      </Link>
    </div>
  )
}
