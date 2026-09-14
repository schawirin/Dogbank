import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses DogBank currency amount', () {
    final value = double.tryParse('35,66'.replaceAll(',', '.'));
    expect(value, 35.66);
  });
}
