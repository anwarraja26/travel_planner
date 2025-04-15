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
        title:'Cheap',
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

export const AI_PROMPT= "Generate a travel plan JSON for:\n- Location: {location}\n- Duration: {totalDays} days\n- Travelers: {traveler}\n- Budget: {budget}\n\nReturn ONLY valid JSON with NO additional text, following this exact structure:\n{\n {\n    \"travelPlan\": {\n      \"budget\": \"string\",\n      \"duration\": \"string\",\n      \"hotelOptions\": [\n        {\n          \"description\": \"string\",\n          \"geoCoordinates\": {\n            \"latitude\": number,\n            \"longitude\": number\n          },\n          \"hotelAddress\": \"string\",\n          \"hotelImageUrl\": \"string\",\n          \"hotelName\": \"string\",\n          \"price\": \"string\",\n          \"rating\": number\n        }\n      ],\n      \"itinerary\": {\n        \"day1\": {\n          \"bestTimeToVisit\": {It should be in the time formated string }\"string\",\n          \"places\": [\n            {\n              \"geoCoordinates\": {\n                \"latitude\": number,\n                \"longitude\": number\n              },\n              \"placeDetails\": \"string\",\n              \"placeImageUrl\": \"string\",\n              \"placeName\": \"string\",\n              \"rating\": number,\n              \"ticketPricing\": \"string\",\n              \"timeSpent\": \"string\",\n              \"travelTime\": \"string\",\n              \"theme\": \"string\"\n            }\n          ]\n        }\n      },\n      \"location\": \"string\",\n      \"travelers\": \"string\"\n    }\n  }\n}"