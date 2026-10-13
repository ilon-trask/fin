import Svg, { Path, Circle } from "react-native-svg"

const Eye = () => (
    <Svg
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={2}
    >
        <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <Circle cx={12} cy={12} r={3} />
    </Svg>
)
export default Eye
