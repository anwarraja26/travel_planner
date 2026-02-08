import { doc,getDoc} from 'firebase/firestore';
import {React,useEffect,useState} from 'react'
import { useParams } from 'react-router-dom'
import {db} from '../../service/firebaseConfig';
import toast from 'react-hot-toast';
import InfoSection from '../components/InfoSection';
import Hotels from '../components/Hotel';
import PlacesToVisit from '../components/PlacesToVisit';

function Viewtrip() {
  const {tripId} = useParams();
  const[trip,setTrip]=useState();
  useEffect(()=>{
    tripId&&GetTripData()
  },[tripId]);

  const GetTripData=async()=>{
    const docRef=doc(db,'AITrips',tripId);
    const docSnap=await getDoc(docRef);
    if(docSnap.exists()){
      console.log("Document data:",docSnap.data());
      setTrip(docSnap.data());
    }
    else{
      console.log("No such document!");
      toast.error("No such document!");
    }

  }
  return (
    <div className='p-10 mf:px-20 lg:px-44 xl:px-56'>

      <InfoSection trip={trip} />
      <Hotels trip={trip} />
      <PlacesToVisit trip={trip} />
    </div>
  )
}

export default Viewtrip