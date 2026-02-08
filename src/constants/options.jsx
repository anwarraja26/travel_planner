export const SelectTravelsList=[
    {
        id:1,
        icon:"🤷",
        title:'Just Me',
        desc:'A sole traveles in exploration',
        people:"1"
    },
    {
        id:2,
        icon:"👩‍❤️‍👨",
        title:'A Couple',
        desc:'Two traveles in tandem',
        people:"2 People"
    },
    {
        id:3,
        icon:"👪",
        title:'Family',
        desc:'A group of fun loving adv',
        people:" 3-5 People"
    },
    {
        id:4,
        icon:"👨‍👩‍👧‍👦",
        title:'Friends',
        desc:'A bunch of thrill-seekes',
        people:" 5-10 People"
    },
]

export const SelectBudgetOptions=[
    {
        id:1,
        icon:"😍",
        title:'Affortable',
        desc:'Stay conscious of costs',
    },
    {
        id:1,
        icon:"😎",
        title:'Moderate',
        desc:'Keep cost on the average side',
    },
    {
        id:1,
        icon:"😌",
        title:'Luxury',
        desc:'Dont worry about cost',
    },
]

export const AI_PROMPT= `Generate a travel plan JSON for:
- Location: {location}
- Duration: {totalDays} days
- Travelers: {traveler}
- Budget: {budget}

CRITICAL REQUIREMENT: You MUST generate exactly {totalDays} days in the itinerary. If {totalDays} is 3, you must generate day1, day2, and day3. If {totalDays} is 5, you must generate day1, day2, day3, day4, and day5. Do NOT default to only 1 day.

Return ONLY valid JSON with NO additional text, following this exact structure:
{
  "travelPlan": {
    "budget": "{budget}",
    "duration": "{totalDays} days",
    "hotelOptions": [
      {
        "description": "Example Hotel Description",
        "geoCoordinates": {
          "latitude": 37.7749,
          "longitude": -122.4194
        },
        "hotelAddress": "123 Main St, Anytown, USA",
        "hotelImageUrl": "https://example.com/hotel-image.jpg",
        "hotelName": "Example Hotel",
        "price": "$200 per night",
        "rating": 4.5
      }
    ],
    "itinerary": {
      {DAYS_STRUCTURE}
    },
    "location": "{location}",
    "travelers": "{traveler}"
  }
}`