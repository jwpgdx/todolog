import React from 'react';
import { Drawer } from 'vaul';
import { View, Text } from 'react-native';
import KeenSliderTest from './keen-slider';

// 스크롤 테스트를 위한 더미 데이터 생성
const dummyItems = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    title: `테스트 아이템 ${i + 1}`,
    desc: '스크롤 동작 및 터치 간섭을 확인하기 위한 텍스트입니다.',
    price: `${(i + 1) * 1000}원`
}));

export default function VaulKeenSliderTest() {
    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Web Drawer + Keen Slider</Text>

            <Drawer.Root shouldScaleBackground>
                <Drawer.Trigger asChild>
                    <button className="bg-black text-white rounded-md px-6 py-3 font-medium hover:bg-zinc-800 transition-colors shadow-lg active:scale-95 transform">
                        Open Picker
                    </button>
                </Drawer.Trigger>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" />
                    {/* max-h-[90vh]로 높이 제한을 두어 내부 스크롤 유도 */}
                    <Drawer.Content className="bg-zinc-50 flex flex-col rounded-t-[10px] mt-24 max-h-[92vh] fixed bottom-0 left-0 right-0 z-50 focus:outline-none">

                        {/* 헤더 및 핸들바 */}
                        <div className="p-4 bg-white rounded-t-[10px] flex-shrink-0 border-b border-zinc-100">
                            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-300 mb-4" />
                            <Drawer.Title className="font-bold text-xl text-center text-zinc-900">
                                Vaul + KeenSlider
                            </Drawer.Title>
                            <p className="text-zinc-500 text-sm text-center mt-1">
                                슬라이더와 세로 스크롤이 혼합된 UI 테스트
                            </p>
                        </div>

                        {/* 스크롤 가능한 메인 컨텐츠 영역 */}
                        <div className="p-4 overflow-y-auto flex-1 bg-white">
                            <div className="max-w-md mx-auto space-y-6">

                                {/* 1. 슬라이더 영역 (가로 스크롤) */}
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-zinc-900 ml-1">Featured Slider</h3>
                                    {/* data-vaul-no-drag 속성은 슬라이더 제스처가 드로어를 닫지 않게 함 */}
                                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 shadow-sm touches-auto" data-vaul-no-drag>
                                        <KeenSliderTest />
                                    </div>
                                    <p className="text-xs text-zinc-400 px-1">
                                        * 슬라이더 영역은 드로어 드래그가 방지되어야 합니다.
                                    </p>
                                </div>

                                {/* 2. 더미 리스트 영역 (세로 스크롤) */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-zinc-900 ml-1">Scroll List Test</h3>
                                    <div className="grid gap-3">
                                        {dummyItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-4 bg-white border border-zinc-100 rounded-xl shadow-sm active:bg-zinc-50 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold">
                                                        {item.id + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-zinc-900">{item.title}</div>
                                                        <div className="text-xs text-zinc-500">{item.desc}</div>
                                                    </div>
                                                </div>
                                                <div className="font-semibold text-zinc-900">{item.price}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. 하단 설명 텍스트 */}
                                <div className="p-4 bg-zinc-50 rounded-lg text-sm text-zinc-600 leading-relaxed">
                                    <p className="font-bold mb-2">테스트 확인 사항:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>리스트를 아래로 당길 때 드로어가 닫히지 않고 스크롤이 되는지 확인하세요.</li>
                                        <li>맨 위로 스크롤 된 상태에서 아래로 당기면 드로어가 닫혀야 합니다.</li>
                                        <li>슬라이더를 좌우로 조작할 때 드로어가 닫히지 않아야 합니다.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 고정된 하단 버튼 영역 */}
                        <div className="p-4 bg-white border-t border-zinc-100 flex-shrink-0 pb-safe">
                            <Drawer.Close asChild>
                                <button className="w-full bg-zinc-900 text-white rounded-xl py-3.5 font-bold text-lg active:scale-[0.98] transition-transform">
                                    닫기
                                </button>
                            </Drawer.Close>
                        </div>

                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </View>
    );
}