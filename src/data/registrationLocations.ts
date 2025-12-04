export type RegistrationLocation = {
  state: string;
  cities: string[];
};

// Static state/city list for registration details selection.
export const REGISTRATION_LOCATIONS: RegistrationLocation[] = [
  {
    state: 'Maharashtra',
    cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Kolhapur'],
  },
  {
    state: 'Karnataka',
    cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Shivamogga'],
  },
  {
    state: 'Delhi',
    cities: ['New Delhi', 'Dwarka', 'Rohini', 'Karol Bagh', 'Saket'],
  },
  {
    state: 'Tamil Nadu',
    cities: ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli', 'Tirunelveli'],
  },
  {
    state: 'Uttar Pradesh',
    cities: ['Lucknow', 'Noida', 'Ghaziabad', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj'],
  },
  {
    state: 'Gujarat',
    cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar'],
  },
  {
    state: 'Andhra Pradesh',
    cities: ['Vijayawada', 'Visakhapatnam', 'Guntur', 'Tirupati', 'Kurnool'],
  },
  {
    state: 'Arunachal Pradesh',
    cities: ['Itanagar', 'Naharlagun', 'Tawang', 'Ziro', 'Pasighat'],
  },
  {
    state: 'Assam',
    cities: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur'],
  },
  {
    state: 'Bihar',
    cities: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
  },
  {
    state: 'Chhattisgarh',
    cities: ['Raipur', 'Bhilai', 'Bilaspur', 'Durg', 'Korba'],
  },
  {
    state: 'Goa',
    cities: ['Panaji', 'Margao', 'Mapusa', 'Ponda', 'Vasco da Gama'],
  },
  {
    state: 'Haryana',
    cities: ['Gurugram', 'Faridabad', 'Panipat', 'Karnal', 'Hisar', 'Ambala'],
  },
  {
    state: 'Himachal Pradesh',
    cities: ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Kullu'],
  },
  {
    state: 'Jharkhand',
    cities: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
  },
  {
    state: 'Kerala',
    cities: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kannur'],
  },
  {
    state: 'Madhya Pradesh',
    cities: ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
  },
  {
    state: 'Manipur',
    cities: ['Imphal', 'Thoubal', 'Bishnupur', 'Ukhrul', 'Churachandpur'],
  },
  {
    state: 'Meghalaya',
    cities: ['Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Baghmara'],
  },
  {
    state: 'Mizoram',
    cities: ['Aizawl', 'Lunglei', 'Saiha', 'Champhai', 'Kolasib'],
  },
  {
    state: 'Nagaland',
    cities: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha'],
  },
  {
    state: 'Odisha',
    cities: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur'],
  },
  {
    state: 'Punjab',
    cities: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  },
  {
    state: 'Rajasthan',
    cities: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  },
  {
    state: 'Sikkim',
    cities: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo'],
  },
  {
    state: 'Telangana',
    cities: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  },
  {
    state: 'Tripura',
    cities: ['Agartala', 'Dharmanagar', 'Udaipur', 'Ambassa', 'Kailashahar'],
  },
  {
    state: 'Uttarakhand',
    cities: ['Dehradun', 'Haridwar', 'Haldwani', 'Rishikesh', 'Roorkee'],
  },
  {
    state: 'West Bengal',
    cities: ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol'],
  },
  {
    state: 'Andaman and Nicobar Islands',
    cities: ['Port Blair', 'Havelock', 'Neil Island'],
  },
  {
    state: 'Chandigarh (UT)',
    cities: ['Chandigarh'],
  },
  {
    state: 'Dadra and Nagar Haveli and Daman and Diu',
    cities: ['Daman', 'Diu', 'Silvassa'],
  },
  {
    state: 'Jammu and Kashmir',
    cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur'],
  },
  {
    state: 'Ladakh',
    cities: ['Leh', 'Kargil'],
  },
  {
    state: 'Lakshadweep',
    cities: ['Kavaratti', 'Agatti', 'Minicoy'],
  },
  {
    state: 'Puducherry',
    cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
  },
];
