import { useGolfer } from '../lib/golfer';
import { PageHead } from '../components/ui';
import MyTours from '../components/MyTours';

export default function MoreTours() {
  const { golfer: profile } = useGolfer();
  return (
    <>
      <PageHead title="My tours" back="/more" />
      <MyTours profile={profile} />
    </>
  );
}
